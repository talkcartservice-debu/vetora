import { FastifyInstance } from 'fastify';
import { CartItem, ICartItem } from '../models/CartItem';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { z } from 'zod';

const addToCartSchema = z.object({
  product_id: z.string(),
  quantity: z.number().min(1).default(1),
  affiliate_email: z.string().email().or(z.literal('')).optional(),
});

const updateCartItemSchema = z.object({
  quantity: z.number().min(1),
});

export async function cartRoutes(fastify: FastifyInstance) {
  // Get user's cart
  fastify.get('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      // Get user info
      const userData = await User.findOne({ email: user.email });
      if (!userData) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const items = await CartItem.find({ user_username: userData.username }).lean();
      return { items };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Add item to cart
  fastify.post('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;
      const { product_id, quantity, affiliate_email } = addToCartSchema.parse(request.body);

      // Get user info
      const userData = await User.findOne({ email: user.email });
      if (!userData) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Check if item already in cart
      let cartItem = await CartItem.findOne({ user_username: userData.username, product_id });

      if (cartItem) {
        cartItem.quantity += quantity;
        await cartItem.save();
        return cartItem;
      }

      // Get product details
      const product = await Product.findById(product_id);
      if (!product) {
        return reply.code(404).send({ error: 'Product not found' });
      }

      cartItem = new CartItem({
        user_email: user.email,
        user_username: userData.username,
        product_id,
        product_title: product.title,
        product_image: product.images[0],
        product_price: product.price,
        store_id: product.store_id,
        store_name: product.store_name,
        quantity,
        affiliate_email,
      });

      await cartItem.save();
      return cartItem;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update cart item quantity
  fastify.put('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { quantity } = updateCartItemSchema.parse(request.body);
      const user = request.user as any;

      // Get user info
      const userData = await User.findOne({ email: user.email });
      if (!userData) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const cartItem = await CartItem.findOneAndUpdate(
        { _id: id, user_username: userData.username },
        { quantity },
        { new: true }
      );

      if (!cartItem) {
        return reply.code(404).send({ error: 'Cart item not found' });
      }

      return cartItem;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Remove item from cart
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      // Get user info
      const userData = await User.findOne({ email: user.email });
      if (!userData) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const result = await CartItem.deleteOne({ _id: id, user_username: userData.username });
      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Cart item not found' });
      }

      return { status: 'deleted' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Clear cart
  fastify.delete('/', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const user = request.user as any;

      // Get user info
      const userData = await User.findOne({ email: user.email });
      if (!userData) {
        return reply.code(404).send({ error: 'User not found' });
      }

      await CartItem.deleteMany({ user_username: userData.username });
      return { status: 'cleared' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}