"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = void 0;
const app_1 = require("firebase-admin/app");
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("firebase-admin/auth");
const fs_1 = __importDefault(require("fs"));
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.local";
// Load environment variables
dotenv_1.default.config({ path: envFile });
// console.log(process.env.FIREBASE_SERVICE_ACCOUNT);
// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
const serviceAccount = JSON.parse(fs_1.default.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"));
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)({
        credential: (0, app_1.cert)(serviceAccount),
    });
}
exports.adminAuth = (0, auth_1.getAuth)();
