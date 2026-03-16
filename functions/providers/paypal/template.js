function getTemplate(server_url, client_id, order_id, amount, currency) {
  return `
    <html>
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Paypal Checkout</title>
        <style>
            body {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 500px;
            }
            #paypal-button-container {
                width: 100%;
                margin-top: 20px;
            }
            .error {
                color: red;
                text-align: center;
                padding: 20px;
            }
        </style>
    </head>
    <body>      
        <div class="container">
            <h2 style="text-align: center; margin-bottom: 20px;">PayPal Payment</h2>
            <div id="paypal-button-container">
                <p style="text-align: center;">Loading PayPal...</p>
            </div>
        </div>
        <script src="https://www.paypal.com/sdk/js?client-id=${client_id}&currency=${currency}"></script>
        <script>
            // Wait for PayPal SDK to load, then initialize buttons
            function initPayPal() {
                if (typeof paypal !== 'undefined' && typeof paypal.Buttons === 'function') {
                    try {
                        paypal.Buttons({
                            createOrder: function(data, actions) {
                                return actions.order.create({
                                    purchase_units: [{
                                        amount: {
                                            value: '${amount}',
                                            currency_code: '${currency}'
                                        }
                                    }]
                                });
                            },
                            onApprove: function(data, actions) {
                                return actions.order.capture().then(function(details) {
                                    window.location.href = "${server_url}paypal-process?order_id=${order_id}&amount=${amount}&id=" + details.id;
                                });
                            },
                            onCancel: function (data) {
                                window.location.href = '${server_url}cancel';
                            },
                            onError: function (err) {
                                console.error('PayPal error:', err);
                                window.location.href = '${server_url}cancel?error=paypal_error';
                            }
                        }).render('#paypal-button-container');
                    } catch (error) {
                        console.error('Error rendering PayPal buttons:', error);
                        document.getElementById('paypal-button-container').innerHTML = 
                            '<div class="error">' +
                            '<p><strong>Error initializing PayPal</strong></p>' +
                            '<p style="font-size: 12px;">' + (error.message || 'Unknown error') + '</p>' +
                            '<p style="font-size: 11px; color: #666; margin-top: 10px;">Client ID: ${client_id ? (client_id.substring(0, 20) + '...') : 'NOT SET'}</p>' +
                            '</div>';
                    }
                } else {
                    // Retry after a short delay
                    setTimeout(initPayPal, 200);
                }
            }
            
            // Start initialization
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initPayPal);
            } else {
                initPayPal();
            }
            
            // Fallback error handler if SDK fails to load after 10 seconds
            setTimeout(function() {
                if (typeof paypal === 'undefined') {
                    document.getElementById('paypal-button-container').innerHTML = 
                        '<div class="error">' +
                        '<p><strong>Failed to load PayPal SDK</strong></p>' +
                        '<p style="font-size: 12px; margin-top: 10px;">Please check:</p>' +
                        '<ul style="text-align: left; display: inline-block; font-size: 12px;">' +
                        '<li>PayPal Client ID is valid</li>' +
                        '<li>Client ID is for the correct environment (sandbox/production)</li>' +
                        '<li>Internet connection is working</li>' +
                        '</ul>' +
                        '<p style="font-size: 11px; color: #666; margin-top: 10px;">Client ID: ${client_id ? (client_id.substring(0, 20) + '...') : 'NOT SET'}</p>' +
                        '<button onclick="window.location.reload()" style="margin-top: 15px; padding: 8px 16px; background: #0070ba; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>' +
                        '</div>';
                }
            }, 10000);
        </script>
    </body>
    </html>
  `;
}

export { getTemplate };

