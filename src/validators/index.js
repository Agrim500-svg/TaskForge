import { body } from "express-validator";
import { AssignableProjectMemberRoles, AvailableTaskStatus } from "../utils/constants.js"


const userRegisterValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),

        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be in lowercase")
            .isLength({ min: 3})
            .withMessage("Username must be at least 3 characters long"),

        body("password")
            .notEmpty()
            .withMessage("Password is required")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters long"),

        body("fullName").optional().trim(),

   ]
}

const userLoginValidator = () => {
    return [
        body().custom((_, { req }) => {
            if (!req.body?.email && !req.body?.username) {
                throw new Error("Email or username is required");
            }
            if (req.body.email && (typeof req.body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email))) {
                throw new Error("Email is invalid");
            }
            if (req.body.username && typeof req.body.username !== "string") {
                throw new Error("Username is invalid");
            }
            return true;
        }),
        body("password")
            .notEmpty()
            .withMessage("Password is required"),
    ];
};

const userChangeCurrentPasswordValidator = () => {
    return [
        body("oldPassword")
            .notEmpty()
            .withMessage("Old password is required"),
        body("newPassword")
            .notEmpty()
            .withMessage("New password is required")
            .isLength({ min: 6 })
            .withMessage("New password must be at least 6 characters long")
    ];
};

const userForgotPasswordValidator = () => {
    return [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
    ];
};

const userRequestEmailVerificationValidator = () => [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Email is invalid"),
];

const userResetForgotPasswordValidator = () => {
    return [
        body("newPassword")
            .notEmpty()
            .withMessage("New password is required")
            .isLength({ min: 6 })
            .withMessage("New password must be at least 6 characters long")
    ];
};

const createProjectValidator = () => {
    return [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Name is required")
            .isLength({ max: 100 })
            .withMessage("Name must be at most 100 characters long"),
        body("description")
            .optional({ nullable: true })
            .isString()
            .withMessage("Description must be a string")
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Description must be at most 1000 characters long"),
    ];
};

const addMembertoProjectValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("role")
            .notEmpty()
            .withMessage("Role is required")
            .isIn(AssignableProjectMemberRoles)
            .withMessage("Role must be project_admin or member"),
    ]
}

const updateMemberRoleValidator = () => [
    body("newRole")
        .notEmpty()
        .withMessage("New role is required")
        .isIn(AssignableProjectMemberRoles)
        .withMessage("New role must be project_admin or member"),
]

const createTaskValidator = () => [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Task title is required")
        .isLength({ max: 200 })
        .withMessage("Task title must be at most 200 characters long"),
    body("description")
        .optional({ nullable: true })
        .isString()
        .withMessage("Task description must be a string")
        .trim()
        .isLength({ max: 5000 })
        .withMessage("Task description must be at most 5000 characters long"),
    body("assignedTo")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Assignee ID is invalid"),
    body("status")
        .optional()
        .isIn(AvailableTaskStatus)
        .withMessage("Task status is invalid"),
    body("dueDate")
        .optional({ nullable: true })
        .isISO8601({ strict: true })
        .withMessage("Due date must be a valid calendar date"),
]

const updateTaskValidator = () => [
    body().custom((_, { req }) => {
        const editableFields = ["title", "description", "assignedTo", "status", "dueDate"];
        if (!editableFields.some((field) => Object.hasOwn(req.body ?? {}, field))) {
            throw new Error("At least one task field must be provided");
        }
        return true;
    }),
    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Task title cannot be empty")
        .isLength({ max: 200 })
        .withMessage("Task title must be at most 200 characters long"),
    body("description")
        .optional({ nullable: true })
        .isString()
        .withMessage("Task description must be a string")
        .trim()
        .isLength({ max: 5000 })
        .withMessage("Task description must be at most 5000 characters long"),
    body("assignedTo")
        .optional({ nullable: true })
        .isMongoId()
        .withMessage("Assignee ID is invalid"),
    body("status")
        .optional()
        .isIn(AvailableTaskStatus)
        .withMessage("Task status is invalid"),
    body("dueDate")
        .optional({ nullable: true })
        .isISO8601({ strict: true })
        .withMessage("Due date must be a valid calendar date"),
]

const createSubtaskValidator = () => [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Subtask title is required")
        .isLength({ max: 200 })
        .withMessage("Subtask title must be at most 200 characters long"),
];

const updateSubtaskValidator = () => [
    body().custom((_, { req }) => {
        const editableFields = ["title", "isCompleted", "status"];
        if (!editableFields.some((field) => Object.hasOwn(req.body ?? {}, field))) {
            throw new Error("At least one subtask field must be provided");
        }
        return true;
    }),
    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Subtask title cannot be empty")
        .isLength({ max: 200 })
        .withMessage("Subtask title must be at most 200 characters long"),
    body("isCompleted")
        .optional()
        .isBoolean()
        .withMessage("Subtask completion status must be a boolean"),
    body("status")
        .optional()
        .isIn(AvailableTaskStatus)
        .withMessage("Subtask status is invalid"),
];

const createNoteValidator = () => [
    body("content")
        .isString()
        .withMessage("Note content must be a string")
        .trim()
        .notEmpty()
        .withMessage("Note content is required")
        .isLength({ max: 10000 })
        .withMessage("Note content must be at most 10000 characters long"),
];

const updateNoteValidator = () => createNoteValidator();

export { userRegisterValidator, userLoginValidator, userChangeCurrentPasswordValidator, userForgotPasswordValidator,
    userRequestEmailVerificationValidator, userResetForgotPasswordValidator, createProjectValidator, addMembertoProjectValidator, updateMemberRoleValidator,
    createTaskValidator, updateTaskValidator, createSubtaskValidator, updateSubtaskValidator,
    createNoteValidator, updateNoteValidator };
