"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const app_1 = __importDefault(require("./app"));
// Load environment variables
(0, dotenv_1.config)();
// Start server
const PORT = process.env.PORT || 3001;
app_1.default.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
