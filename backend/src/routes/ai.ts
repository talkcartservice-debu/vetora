import { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'mock-key',
});

const aiInvokeSchema = z.object({
  prompt: z.string().min(1),
  system_prompt: z.string().optional(),
  max_tokens: z.number().default(1024),
});

export async function aiRoutes(fastify: FastifyInstance) {
  // Invoke AI assistant
  fastify.post('/invoke', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { prompt, system_prompt, max_tokens } = aiInvokeSchema.parse(request.body);

      const message = await anthropic.messages.create({
        model: "claude-3-opus-20240229",
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
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Generate product description
  fastify.post('/generate-product-description', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { title, features } = request.body as { title: string, features: string[] };
      
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
    } catch (error) {
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
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}