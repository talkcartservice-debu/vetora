import { User } from '../models/User';
import { WishlistItem } from '../models/WishlistItem';
import { Like } from '../models/Like';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Post } from '../models/Post';

/**
 * Service to fetch and format user context for the AI prompt
 */
export async function getUserContext(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) {
    return null;
  }

  const username = user.username.toLowerCase();

  // Fetch last 5 WishlistItems
  const wishlistItems = await WishlistItem.find({ user_username: username })
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  // Fetch more context for wishlist items (categories)
  const wishlistContext = await Promise.all(wishlistItems.map(async (item) => {
    const product = await Product.findById(item.product_id).select('category').lean();
    return {
      title: item.product_title,
      price: item.product_price,
      category: product?.category || 'other'
    };
  }));

  // Fetch last 5 Likes (posts or products)
  const likes = await Like.find({ 
    user_username: username,
    target_type: { $in: ['post', 'product'] }
  })
    .sort({ created_at: -1 })
    .limit(5)
    .lean();

  // Fetch details for likes to provide better context
  const likesContext = await Promise.all(likes.map(async (like) => {
    if (like.target_type === 'product') {
      const product = await Product.findById(like.target_id).select('title category').lean();
      return product ? `Liked Product: ${product.title} (${product.category})` : null;
    } else if (like.target_type === 'post') {
      const post = await Post.findById(like.target_id).select('content tagged_products').lean();
      if (!post) return null;
      
      let context = `Liked Post: ${post.content.substring(0, 50)}...`;
      if (post.tagged_products?.length > 0) {
        const products = await Product.find({ _id: { $in: post.tagged_products } }).select('category').lean();
        const categories = [...new Set(products.map(p => p.category))];
        if (categories.length > 0) {
          context += ` (Categories: ${categories.join(', ')})`;
        }
      }
      return context;
    }
    return null;
  }));

  // Fetch last 3 Orders
  const orders = await Order.find({ buyer_username: username })
    .sort({ created_at: -1 })
    .limit(3)
    .lean();

  return {
    user: {
      display_name: user.display_name || user.username,
      username: user.username
    },
    wishlist: wishlistContext,
    likes: likesContext.filter(Boolean),
    orders: orders.map(order => ({
      id: order._id.toString(),
      status: order.status,
      total: order.total,
      itemCount: order.items.length,
      items: order.items.map(i => i.product_title).join(', ')
    }))
  };
}

/**
 * Fetch top 10 products for "Daily Picks"
 */
export async function getDiscoveryContext() {
  // Fetch top 10 products by sales_count or rating_avg
  const trendingProducts = await Product.find({ status: 'active' })
    .sort({ sales_count: -1, rating_avg: -1 })
    .limit(10)
    .lean();

  return trendingProducts.map(p => ({
    id: p._id.toString(),
    title: p.title,
    price: p.price,
    category: p.category,
    rating: p.rating_avg,
    sales: p.sales_count
  }));
}

/**
 * Query the database for relevant products based on a search query
 */
export async function searchProducts(query: string) {
  if (!query) return [];

  // Simple regex-based search for titles, descriptions, categories, and tags
  const searchRegex = new RegExp(query, 'i');
  const products = await Product.find({
    status: 'active',
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { tags: searchRegex }
    ]
  })
    .sort({ plan_priority: -1, sales_count: -1 })
    .limit(10)
    .lean();

  return products.map(p => ({
    id: p._id.toString(),
    title: p.title,
    price: p.price,
    category: p.category,
    description: p.description?.substring(0, 100),
    image: p.images?.[0]
  }));
}

/**
 * Construct the master system prompt for the AI
 */
export function formatSystemPrompt(
  userContext: any, 
  discoveryContext: any[], 
  searchContext: any[] = []
) {
  const userName = userContext?.user?.display_name || 'there';
  
  let prompt = `You are IQON AI, ${userName}'s personal shopping concierge and order assistant. 
Your goal is to provide a premium, helpful, and personalized shopping experience.

`;

  if (userContext) {
    prompt += `USER CONTEXT:
- Name: ${userName}
`;
    if (userContext.wishlist?.length > 0) {
      prompt += `- Recently Wishlisted: ${userContext.wishlist.map((i: any) => `${i.title} ($${i.price})`).join(', ')}\n`;
    }
    if (userContext.likes?.length > 0) {
      prompt += `- Recent Interests: ${userContext.likes.join('; ')}\n`;
    }
    if (userContext.orders?.length > 0) {
      prompt += `- Recent Orders:\n${userContext.orders.map((o: any) => `  * Order #${o.id}: Status: ${o.status}, Total: $${o.total}, Items: ${o.items}`).join('\n')}\n`;
    }
    prompt += '\n';
  }

  const productsToShow = searchContext.length > 0 ? searchContext : discoveryContext;
  if (productsToShow?.length > 0) {
    prompt += `AVAILABLE PRODUCTS TO RECOMMEND:
${productsToShow.map((p: any) => `- [ID: ${p.id}] ${p.title} - $${p.price} (${p.category})`).join('\n')}

`;
  }

  prompt += `CAPABILITIES & GUIDELINES:
1. PERSONALIZATION: Use the user's context to make relevant recommendations. If they liked denim, suggest matching items.
2. ORDER CONCIERGE: If asked about an order, provide the status from the context. If you find a matching order, ALWAYS trigger an ORDER_CARD action.
3. ACTIONS: You can trigger specialized UI components using this format at the end of your message: [ACTION: TYPE, id: VALUE]
   - For orders: [ACTION: ORDER_CARD, id: ORDER_ID]
4. DISCOVERY: If it's a new conversation or the user asks "what's new", show the available products.
5. STYLE: Be concise, friendly, and helpful. Use emojis occasionally to maintain a social commerce vibe. 🛍️✨

Remember: Never share sensitive user data like full addresses or payment details.`;

  return prompt;
}
