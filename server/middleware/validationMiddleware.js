const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse(req.body);
        req.body = parsed;
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: error.errors
            });
        }
        next(error);
    }
};

const VariableSchema = z.object({
    key: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, 'Key must be alphanumeric with underscores'),
    label: z.string().min(1).max(100),
    value: z.string().optional()
});

module.exports = {
    validate,
    Schemas: {
        Variable: VariableSchema
    }
};
