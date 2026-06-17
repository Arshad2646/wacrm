import type { BusinessKnowledgeBundle } from '@/lib/knowledge/types';

export interface ChatPrompt {
  system: string;
  user: string;
}

export interface ConversationTurn {
  role: 'customer' | 'assistant';
  content: string;
}

function line(label: string, value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : `${label}: Not provided`;
}

function formatProducts(bundle: BusinessKnowledgeBundle): string {
  if (bundle.activeProducts.length === 0) {
    return 'No active products/services have been added.';
  }

  return bundle.activeProducts
    .map((product, index) => {
      return [
        `${index + 1}. ${product.name}`,
        line('Price', product.price_text),
        line('Availability', product.availability_text),
        line('Category', product.category),
        line('Description', product.description),
      ].join('\n');
    })
    .join('\n\n');
}

function formatKnowledge(bundle: BusinessKnowledgeBundle): string {
  if (bundle.activeKnowledgeEntries.length === 0) {
    return 'No active FAQs or knowledge entries have been added.';
  }

  return bundle.activeKnowledgeEntries
    .map((entry, index) => {
      return [
        `${index + 1}. ${entry.title}`,
        line('Category', entry.category),
        `Answer: ${entry.content}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function buildBusinessScopedPrompt(
  bundle: BusinessKnowledgeBundle,
  customerMessage: string
): ChatPrompt {
  const profile = bundle.profile;
  const fallback =
    profile?.fallback_message ||
    'Thank you for your message. Our team will get back to you shortly.';
  const tone = profile?.bot_tone ?? 'friendly';

  const system = `
You are the WhatsApp AI sales assistant for ${bundle.account.name}.

Scope:
- Answer only using the business knowledge provided below.
- Help with this business's products, prices, stock/availability, services, location, opening hours, delivery, payment, ordering/contact process, and FAQs.
- Do not answer general knowledge, homework, maths, jokes, coding, essays, personal advice, medical advice, legal advice, financial advice, or unrelated questions.
- If a customer asks a mixed question, answer only the business-related part and politely refuse the unrelated part.
- If the business knowledge does not contain the answer, do not guess. Say the team will confirm and use this fallback message when useful: "${fallback}"
- Keep replies concise and suitable for WhatsApp.
- Use a ${tone} tone.
- Ask for useful missing buying details when relevant, such as customer name, location/delivery area, product wanted, quantity, or budget.
- Detect buying intent internally from the conversation. If the customer shows interest in buying, availability, price, delivery, payment, or ordering, treat that as buying intent. Do not expose hidden analysis; only write the customer-facing reply.

Business profile:
${line('Description', profile?.business_description)}
${line('Location', profile?.location)}
${line('Opening hours', profile?.opening_hours)}
${line('Services', profile?.services_summary)}
${line('Delivery', profile?.delivery_info)}
${line('Payment', profile?.payment_info)}
${line('Ordering instructions', profile?.order_instructions)}

Products/services:
${formatProducts(bundle)}

FAQs / knowledge:
${formatKnowledge(bundle)}
`.trim();

  return {
    system,
    user: customerMessage.trim(),
  };
}

export function buildBusinessScopedConversationPrompt(
  bundle: BusinessKnowledgeBundle,
  turns: ConversationTurn[]
): ChatPrompt {
  const cleanTurns = turns
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim(),
    }))
    .filter((turn) => turn.content.length > 0)
    .slice(-12);
  const latestCustomerMessage = [...cleanTurns]
    .reverse()
    .find((turn) => turn.role === 'customer')?.content;

  if (!latestCustomerMessage) {
    throw new Error('Enter a customer message to test.');
  }

  const prompt = buildBusinessScopedPrompt(bundle, latestCustomerMessage);
  const transcript = cleanTurns
    .map((turn) => {
      const label = turn.role === 'customer' ? 'Customer' : 'Assistant';
      return `${label}: ${turn.content}`;
    })
    .join('\n');

  return {
    system: prompt.system,
    user: `
Conversation so far:
${transcript}

Reply only to the latest customer message. Use the earlier messages only as conversation context.
`.trim(),
  };
}
