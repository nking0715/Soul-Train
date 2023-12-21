exports.parseQueryParam = (param, defaultValue) => {
    const parsed = parseInt(param, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};