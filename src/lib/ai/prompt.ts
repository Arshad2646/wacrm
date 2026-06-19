import type { BusinessKnowledgeBundle } from '@/lib/knowledge/types';

export interface ChatPrompt {
  system: string;
  user: string;
}

export interface ConversationTurn {
  role: 'customer' | 'assistant';
  content: string;
}

const MAX_FIELD_CHARS = 800;
const MAX_CUSTOMER_MESSAGE_CHARS = 2000;
const MAX_TRANSCRIPT_TURN_CHARS = 1200;
const MAX_PRODUCTS_SECTION_CHARS = 12000;
const MAX_KNOWLEDGE_SECTION_CHARS = 12000;

function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function line(label: string, value: string | null | undefined): string {
  const trimmed = value ? truncateText(value, MAX_FIELD_CHARS) : '';
  return trimmed ? `${label}: ${trimmed}` : `${label}: Not provided`;
}

function addWithBudget(
  parts: string[],
  next: string,
  maxChars: number
): boolean {
  const currentLength = parts.join('\n\n').length;
  const separatorLength = parts.length === 0 ? 0 : 2;
  if (currentLength + separatorLength + next.length > maxChars) return false;
  parts.push(next);
  return true;
}

function formatProducts(bundle: BusinessKnowledgeBundle): string {
  if (bundle.activeProducts.length === 0) {
    return 'No active products/services have been added.';
  }

  const parts: string[] = [];
  for (const [index, product] of bundle.activeProducts.entries()) {
    const next = [
      `${index + 1}. ${truncateText(product.name, MAX_FIELD_CHARS)}`,
      line('Price', product.price_text),
      line('Availability', product.availability_text),
      line('Category', product.category),
      line('Description', product.description),
    ].join('\n');

    if (!addWithBudget(parts, next, MAX_PRODUCTS_SECTION_CHARS)) {
      parts.push(
        'Additional products/services were omitted to keep the prompt concise.'
      );
      break;
    }
  }

  return parts.join('\n\n');
}

function formatKnowledge(bundle: BusinessKnowledgeBundle): string {
  if (bundle.activeKnowledgeEntries.length === 0) {
    return 'No active FAQs or knowledge entries have been added.';
  }

  const parts: string[] = [];
  for (const [index, entry] of bundle.activeKnowledgeEntries.entries()) {
    const next = [
      `${index + 1}. ${truncateText(entry.title, MAX_FIELD_CHARS)}`,
      line('Category', entry.category),
      `Answer: ${truncateText(entry.content, MAX_FIELD_CHARS)}`,
    ].join('\n');

    if (!addWithBudget(parts, next, MAX_KNOWLEDGE_SECTION_CHARS)) {
      parts.push(
        'Additional FAQs/knowledge entries were omitted to keep the prompt concise.'
      );
      break;
    }
  }

  return parts.join('\n\n');
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
    user: truncateText(customerMessage, MAX_CUSTOMER_MESSAGE_CHARS),
  };
}

export function buildBusinessScopedConversationPrompt(
  bundle: BusinessKnowledgeBundle,
  turns: ConversationTurn[]
): ChatPrompt {
  const cleanTurns = turns
    .map((turn) => ({
      role: turn.role,
      content: truncateText(turn.content, MAX_TRANSCRIPT_TURN_CHARS),
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
