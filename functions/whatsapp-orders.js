import { logger } from 'firebase-functions';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';

const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_RECIPIENT_NUMBER = defineSecret('WHATSAPP_RECIPIENT_NUMBER');
const WHATSAPP_TEMPLATE_NAME = defineSecret('WHATSAPP_TEMPLATE_NAME');
const WHATSAPP_TEMPLATE_LANGUAGE = defineSecret('WHATSAPP_TEMPLATE_LANGUAGE');

const sanitizeValue = (value, fallback = 'N/A') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized || fallback;
};

const formatCurrency = (value, currency = 'SAR') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 'N/A';
  }

  const isWhole = Math.abs(amount - Math.round(amount)) < 1e-9;
  const formatted = isWhole ? String(Math.round(amount)) : amount.toFixed(2);
  return `${formatted} ${currency}`;
};

const buildItemsSummary = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'N/A';
  }

  return items
    .slice(0, 6)
    .map((item) => {
      const productName = sanitizeValue(item?.productName);
      const quantity = Number(item?.quantity || 0);
      const price = Number(item?.price);
      const variantValue = sanitizeValue(item?.variant?.value, '');
      const variantText = variantValue && variantValue !== 'N/A' ? ` (${variantValue})` : '';
      const quantityText = quantity > 0 ? ` x${quantity}` : '';
      const priceText = Number.isFinite(price) ? ` - ${price % 1 === 0 ? Math.round(price) : price.toFixed(2)}` : '';
      return `${productName}${variantText}${quantityText}${priceText}`;
    })
    .join('\n');
};

const normalizePhoneE164DigitsOnly = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits || '';
};

const buildAddressSummary = (shippingAddress) => {
  if (!shippingAddress || typeof shippingAddress !== 'object') {
    return 'N/A';
  }

  const parts = [
    shippingAddress.address,
    shippingAddress.city,
    shippingAddress.state,
    shippingAddress.country,
  ]
    .map((part) => sanitizeValue(part, ''))
    .filter(Boolean);

  return parts.length ? parts.join(', ') : 'N/A';
};

const buildOrderMessage = (orderData) => {
  const shippingAddress = orderData?.shippingAddress || {};
  const orderId = sanitizeValue(orderData?.id || orderData?.orderId);
  const productDetails = buildItemsSummary(orderData?.items);
  const totalAmount = formatCurrency(orderData?.totalAmount);
  const customerName = sanitizeValue(shippingAddress.fullName);
  const phone = sanitizeValue(shippingAddress.phone);
  const address = buildAddressSummary(shippingAddress);

  return [
    'New Order',
    '',
    `Order ID: ${orderId}`,
    `Products: ${productDetails}`,
    `Total: ${totalAmount}`,
    `Customer: ${customerName}`,
    `Phone: ${phone}`,
    `Address: ${address}`,
  ].join('\n');
};

const getNumberOrNull = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const sumItemsTotal = (items) => {
  if (!Array.isArray(items) || !items.length) return null;
  let total = 0;
  for (const item of items) {
    const price = getNumberOrNull(item?.price);
    const qty = getNumberOrNull(item?.quantity) ?? 0;
    if (price === null) return null;
    total += price * qty;
  }
  return total;
};

const formatOrderDate = (createdAt) => {
  try {
    const date =
      createdAt?.toDate?.() ||
      (typeof createdAt === 'string' ? new Date(createdAt) : null) ||
      (typeof createdAt?.seconds === 'number' ? new Date(createdAt.seconds * 1000) : null);
    if (!date || Number.isNaN(date.getTime())) return 'N/A';
    // Match WhatsApp preview style loosely
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return 'N/A';
  }
};

const buildTemplateComponents = (orderData, orderId) => {
  const shippingAddress = orderData?.shippingAddress || {};
  const currency = orderData?.currency || orderData?.currencyCode || 'SAR';

  const customerName = sanitizeValue(shippingAddress.fullName);
  const customerPhoneRaw = sanitizeValue(shippingAddress.phone, '');
  const customerPhone = customerPhoneRaw ? normalizePhoneE164DigitsOnly(customerPhoneRaw) : 'N/A';
  const address = buildAddressSummary(shippingAddress);
  const orderItems = buildItemsSummary(orderData?.items);
  const orderNo = sanitizeValue(orderId);
  const orderAmount = formatCurrency(orderData?.totalAmount, currency);

  // WhatsApp template variables are positional: {{1}}, {{2}}, ...
  // Template `new_order_full_alert` expects 10 variables (from your screenshot preview):
  // 1) customer name
  // 2) phone number
  // 3) email
  // 4) address
  // 5) order details
  // 6) shipping method
  // 7) order amount (subtotal/items total)
  // 8) shipping amount
  // 9) total amount
  // 10) order date
  const email = sanitizeValue(shippingAddress.email);
  const shippingMethod = sanitizeValue(
    orderData?.shippingMethod ||
      orderData?.carrierName ||
      orderData?.shippingRateName ||
      'To be confirmed'
  );
  const shippingCostNumber = getNumberOrNull(orderData?.shippingCost);
  const itemsTotal = getNumberOrNull(orderData?.subtotal) ?? sumItemsTotal(orderData?.items);
  const orderAmountComputed = itemsTotal !== null ? formatCurrency(itemsTotal, currency) : formatCurrency(orderData?.totalAmount, currency);
  const shippingAmount = shippingCostNumber !== null ? formatCurrency(shippingCostNumber, currency) : 'N/A';
  const totalAmount = formatCurrency(orderData?.totalAmount, currency);
  const orderDate = formatOrderDate(orderData?.createdAt);

  const bodyParams = [
    customerName,
    customerPhone,
    email,
    address,
    orderItems,
    shippingMethod,
    orderAmountComputed,
    shippingAmount,
    totalAmount,
    orderDate,
  ].map((text) => ({ type: 'text', text: sanitizeValue(text) }));

  return [
    {
      type: 'body',
      parameters: bodyParams,
    },
  ];
};

const sendWhatsAppRequest = async (url, accessToken, payload) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(JSON.stringify({
      status: response.status,
      response: errorText,
    }));
  }

  return response.json();
};

export const sendWhatsAppOrderNotification = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    region: 'us-central1',
    secrets: [
      WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_RECIPIENT_NUMBER,
      WHATSAPP_TEMPLATE_NAME,
      WHATSAPP_TEMPLATE_LANGUAGE,
    ],
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.warn('Firestore event received without snapshot data.');
      return;
    }

    const orderData = snapshot.data();
    const orderId = event.params.orderId;

    if (!orderData) {
      logger.warn('Order document is empty.', { orderId });
      return;
    }

    // Only send WhatsApp notification for WhatsApp checkout orders
    if (orderData.paymentMethod !== 'whatsapp') {
      return;
    }

    const accessToken = WHATSAPP_ACCESS_TOKEN.value();
    const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value();
    const recipientNumber = normalizePhoneE164DigitsOnly(WHATSAPP_RECIPIENT_NUMBER.value());
    const templateName = sanitizeValue(WHATSAPP_TEMPLATE_NAME.value(), 'hello_world');
    const templateLanguage = sanitizeValue(WHATSAPP_TEMPLATE_LANGUAGE.value(), 'en_US');

    if (!accessToken || !phoneNumberId || !recipientNumber) {
      logger.error('Missing WhatsApp secret configuration.', {
        hasAccessToken: Boolean(accessToken),
        hasPhoneNumberId: Boolean(phoneNumberId),
        hasRecipientNumber: Boolean(recipientNumber),
        orderId,
      });
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

    try {
      const result = await sendWhatsAppRequest(url, accessToken, {
        messaging_product: 'whatsapp',
        to: recipientNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: buildTemplateComponents(orderData, orderId),
        },
      });

      logger.info('WhatsApp order template notification sent successfully.', {
        orderId,
        recipientNumber,
        mode: 'template',
        templateName,
        templateLanguage,
        result,
      });
      return;
    } catch (error) {
      logger.warn('WhatsApp template notification failed. Retrying with plain text.', {
        orderId,
        recipientNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const messageBody = buildOrderMessage({
        id: orderId,
        ...orderData,
      });

      const result = await sendWhatsAppRequest(url, accessToken, {
        messaging_product: 'whatsapp',
        to: recipientNumber,
        type: 'text',
        text: { body: messageBody },
      });

      logger.info('WhatsApp order text notification sent successfully.', {
        orderId,
        recipientNumber,
        mode: 'text',
        result,
      });
    } catch (error) {
      logger.error('Failed to send WhatsApp order notification.', {
        orderId,
        recipientNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);
