import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Helper to get Anthropic client dynamically
const getAnthropicClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const isInvalid = !apiKey || apiKey === 'your-anthropic-key' || apiKey === 'mock-key';
  
  return new Anthropic({
    apiKey: isInvalid ? 'mock-key' : apiKey,
  });
};

// Helper to check if we should use mock mode
const shouldShowMock = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return !apiKey || apiKey === 'your-anthropic-key' || apiKey === 'mock-key';
};

// Helper for mock responses when key is invalid
const getMockResponse = (prompt: string): string => {
  const p = prompt.toLowerCase();
  if (p.includes('fashion') || p.includes('clothes')) {
    return "I found some trending fashion items for you! Check out our latest **Oversized Cotton Hoodies** ($45), **Vintage Denim Jackets** ($89), and **Urban Streetwear Tees** ($29). Most of these are currently top-sellers and have great reviews!";
  }
  if (p.includes('shipping')) {
    return "Standard shipping on Vetora takes **3-7 business days**. Many stores offer free shipping on orders over $75. Express shipping (1-2 days) is also available for most items.";
  }
  if (p.includes('return') || p.includes('refund')) {
    return "Vetora's standard policy allows returns within **30 days** of delivery. Items must be in their original condition. Some specialty stores may offer up to 60 days.";
  }
  return "I'm currently running in **demo mode** because the AI API key is not configured correctly. However, I can still help you with general information about Vetora! Feel free to ask about products, shipping, or returns.";
};

const aiInvokeSchema = z.object({
  prompt: z.string().min(1),
  system_prompt: z.string().optional(),
  max_tokens: z.number().default(1024),
});

const aiChatSchema = z.object({
  prompt: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional(),
  system_prompt: z.string().optional(),
  max_tokens: z.number().default(1024),
});

export async function aiRoutes(fastify: FastifyInstance) {
  // Chat with AI assistant (supports history)
  fastify.post('/chat', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { prompt, messages = [], system_prompt, max_tokens } = aiChatSchema.parse(request.body);

      if (shouldShowMock()) {
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate AI latency
        return {
          response: getMockResponse(prompt),
          usage: { input_tokens: 0, output_tokens: 0 }
        };
      }

      const anthropic = getAnthropicClient();
      
      // Convert messages to Anthropic format and include the latest prompt
      const anthropicMessages: any[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add the latest user prompt
      anthropicMessages.push({ role: 'user', content: prompt });

      const response = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens,
        system: system_prompt || "You are Vetora AI, a helpful social commerce assistant.",
        messages: anthropicMessages,
      });

      return {
        response: (response.content[0] as any).text,
        usage: response.usage
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      
      // Handle Anthropic specific authentication errors
      if (error.status === 401 || error.message?.includes('api-key') || error.message?.includes('authentication')) {
        fastify.log.warn('AI API key is invalid or unauthorized, falling back to mock response');
        const body = request.body as any;
        return {
          response: getMockResponse(body?.prompt || ''),
          usage: { input_tokens: 0, output_tokens: 0 }
        };
      }

      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Invoke AI assistant (single prompt)
  fastify.post('/invoke', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { prompt, system_prompt, max_tokens } = aiInvokeSchema.parse(request.body);

      if (shouldShowMock()) {
        return {
          response: getMockResponse(prompt),
          usage: { input_tokens: 0, output_tokens: 0 }
        };
      }

      const anthropic = getAnthropicClient();

      const message = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens,
        system: system_prompt || "You are Vetora AI, a helpful social commerce assistant.",
        messages: [
          { role: "user", content: prompt }
        ],
      });

      return {
        response: (message.content[0] as any).text,
        usage: message.usage
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }

      if (error.status === 401 || error.message?.includes('api-key') || error.message?.includes('authentication')) {
        const body = request.body as any;
        return {
          response: getMockResponse(body?.prompt || ''),
          usage: { input_tokens: 0, output_tokens: 0 }
        };
      }

      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Generate product content (title, description, tags)
  fastify.post('/generate-product-content', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { category, keyFeatures } = request.body as { category: string, keyFeatures: string };
      
      if (shouldShowMock()) {
        return {
          title: `Premium ${category.charAt(0).toUpperCase() + category.slice(1)} Item`,
          description: `This is a high-quality ${category} product featuring: ${keyFeatures}. Designed for durability and style, it's perfect for everyday use. (AI Demo Mode)`,
          tags: [category, "premium", "quality", "new-arrival", "trending"],
          seo_title: `Buy ${category.charAt(0).toUpperCase() + category.slice(1)} - Vetora Marketplace`
        };
      }

      const anthropic = getAnthropicClient();

      const prompt = `Based on the following features, generate a product title, a compelling description, and 5 SEO tags for a product in the "${category}" category. 
      Key Features: ${keyFeatures}
      
      Return ONLY a JSON object with the following fields: title, description, tags (array), seo_title. Do not include any other text or explanations.`;

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        system: "You are an expert e-commerce copywriter. Return ONLY valid JSON.",
        messages: [
          { role: "user", content: prompt }
        ],
      });

      const responseText = (message.content[0] as any).text;
      try {
        const content = JSON.parse(responseText.trim());
        return content;
      } catch (e) {
        fastify.log.error('Failed to parse AI content JSON', responseText);
        return reply.code(500).send({ error: 'Failed to generate product content' });
      }
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes('api-key') || error.message?.includes('authentication')) {
        const { category = 'Product', keyFeatures = '' } = request.body as any;
        return {
          title: `Premium ${category} Item`,
          description: `This is a high-quality ${category} product featuring: ${keyFeatures}. (AI Demo Mode)`,
          tags: [category, "premium", "quality"],
          seo_title: `Buy ${category} - Vetora`
        };
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Generate sentiment summary from reviews
  fastify.post('/generate-sentiment-summary', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { productId, reviews } = request.body as { productId: string, reviews: any[] };
      
      if (shouldShowMock()) {
        return {
          overall_sentiment: "positive",
          sentiment_score: 85,
          summary_text: "Customers generally love this product for its quality and value. (AI Demo Mode)",
          pros: ["Good build quality", "Fast shipping", "Reasonable price"],
          cons: ["Limited color options", "Packaging could be better"]
        };
      }

      if (!reviews || reviews.length === 0) {
        return reply.code(400).send({ error: 'No reviews provided' });
      }

      const anthropic = getAnthropicClient();

      const reviewsText = reviews.map(r => `Rating: ${r.rating}, Comment: ${r.comment}`).join('\n---\n');
      const prompt = `Analyze these customer reviews for a product and generate a sentiment summary:
      
      Reviews:
      ${reviewsText}
      
      Return ONLY a JSON object with the following fields:
      - overall_sentiment: one of "very_positive", "positive", "neutral", "negative", "very_negative"
      - sentiment_score: number between 0 and 100
      - summary_text: a concise 1-2 sentence summary of common feedback
      - pros: array of top 3-4 positive points
      - cons: array of top 3-4 negative points/concerns
      
      Do not include any other text or explanations.`;

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        system: "You are a data analyst. Return ONLY valid JSON.",
        messages: [
          { role: "user", content: prompt }
        ],
      });

      const responseText = (message.content[0] as any).text;
      try {
        const summary = JSON.parse(responseText.trim());
        return summary;
      } catch (e) {
        fastify.log.error('Failed to parse sentiment JSON', responseText);
        return reply.code(500).send({ error: 'Failed to generate sentiment summary' });
      }
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes('api-key') || error.message?.includes('authentication')) {
        return {
          overall_sentiment: "positive",
          sentiment_score: 80,
          summary_text: "Most customers are satisfied with their purchase. (AI Demo Mode)",
          pros: ["User friendly", "Good quality"],
          cons: ["Slightly expensive"]
        };
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Generate product description (legacy/simple)
  fastify.post('/generate-product-description', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { title, features } = request.body as { title: string, features: string[] };
      
      if (shouldShowMock()) {
        return {
          description: `Introducing the ${title}. Key features include: ${features.join(', ')}. This product offers exceptional quality and performance for all your needs. (AI Demo Mode)`
        };
      }

      const anthropic = getAnthropicClient();

      const prompt = `Generate a compelling product description for a product titled "${title}" with the following features: ${features.join(', ')}. Keep it concise and focused on benefits.`;

      const message = await anthropic.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 500,
        system: "You are a professional copywriter for an e-commerce platform.",
        messages: [
          { role: "user", content: prompt }
        ],
      });

      return {
        description: (message.content[0] as any).text
      };
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes('api-key') || error.message?.includes('authentication')) {
        const { title = 'Product', features = [] } = request.body as any;
        return {
          description: `Experience the best with ${title}. Features include ${features.join(', ')}. (AI Demo Mode)`
        };
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Translate texts
  fastify.post('/translate', {
    // preHandler: [fastify.authenticate], // Allow public translation for better UX? Or keep it private?
  }, async (request, reply) => {
    try {
      const { texts, targetLang } = request.body as { texts: string[], targetLang: string };
      
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return reply.code(400).send({ error: 'Missing or invalid texts array' });
      }

      if (shouldShowMock()) {
        return { translations: texts.map(t => `${t} [${targetLang}]`) };
      }

      const anthropic = getAnthropicClient();

      const prompt = `Translate the following array of strings into ${targetLang}. Return ONLY a JSON array of translated strings in the same order. Do not include any other text or explanations.\n\nStrings to translate: ${JSON.stringify(texts)}`;

      const message = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // Use a cheaper model for translation
        max_tokens: 2000,
        system: "You are a professional translator. Return ONLY a valid JSON array of strings.",
        messages: [
          { role: "user", content: prompt }
        ],
      });

      const responseText = (message.content[0] as any).text;
      try {
        const translations = JSON.parse(responseText.trim());
        return { translations };
      } catch (e) {
        fastify.log.error('Failed to parse translation JSON', responseText);
        return { translations: texts }; // Fallback to original
      }
    } catch (error: any) {
      if (error.status === 401 || error.message?.includes('api-key') || error.message?.includes('authentication')) {
        const { texts = [] } = request.body as any;
        return { translations: texts };
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}