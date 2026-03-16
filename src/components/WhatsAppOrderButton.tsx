import React from 'react';

const WhatsAppOrderButton = () => {
  const handleWhatsAppOrder = () => {
    // Logic to construct WhatsApp message with order details
    const message = "Hello, I'd like to place an order for..."; // Replace with actual order details
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <button onClick={handleWhatsAppOrder}>
      Order via WhatsApp
    </button>
  );
};

export default WhatsAppOrderButton;
