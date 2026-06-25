const errorHandler = (err, req, res, next) => {
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) console.error(err.stack);

    let message = err.message || 'Internal Server Error';

    if (err.name === 'CastError') {
        message = 'Resource not found';
        return res.status(404).json({ success: false, message });
    }

    if (err.code === 11000) {
        message = 'Duplicate field value entered';
        return res.status(400).json({ success: false, message });
    }

    if (err.name === 'ValidationError') {
        message = Object.values(err.errors).map(val => val.message).join(', ');
        return res.status(400).json({ success: false, message });
    }

    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body too large' });
    }

    res.status(err.statusCode || 500).json({
        success: false,
        message: isDev ? message : 'Internal Server Error'
    });
};

export default errorHandler;