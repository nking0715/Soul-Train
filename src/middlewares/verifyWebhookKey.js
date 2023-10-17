const MONITOR_CONTENT_KEY = process.env.WEBHOOK_HEADER_NAME;
const EXPECTED_KEY_VALUE = process.env.WEBHOOK_HEADER_VALUE;

exports.verifyWebhookKey = async (req, res, next) => {
    const receivedKey = req.headers[MONITOR_CONTENT_KEY];
    if (receivedKey && receivedKey === EXPECTED_KEY_VALUE) {
        next(); // Valid key, proceed to process the webhook.
    } else {
        res.status(403).send('Forbidden: Invalid Webhook Key');
    }
};
