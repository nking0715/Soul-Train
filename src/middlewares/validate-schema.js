// Import validationResult from express-validator
const { validationResult } = require('express-validator');

// Define middleware function
module.exports = (req, res, next) => {
    // Check for errors in request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Retrieve the first error message
        const firstError = errors.array()[0].msg;

        // Return the custom error response
        return res.status(400).json({
            success: false,
            message: firstError,
            token: "",
        });
    }

    // Call next middleware function if there are no errors
    next();
};
