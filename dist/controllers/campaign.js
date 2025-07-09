"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCampaigns = exports.createCampaign = void 0;
const client_1 = require("@prisma/client");
const error_1 = require("../middleware/error");
const prisma = new client_1.PrismaClient();
const createCampaign = async (req, res, next) => {
    try {
        const { name, subject, template } = req.body;
        if (!name || !subject || !template) {
            throw new error_1.AppError(400, "All fields are required");
        }
        const campaign = await prisma.campaign.create({
            data: { name, subject, template },
        });
        res.status(201).json({ status: "success", data: { campaign } });
    }
    catch (error) {
        next(error);
    }
};
exports.createCampaign = createCampaign;
const getCampaigns = async (_req, res, next) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.json({ status: "success", data: { campaigns } });
    }
    catch (error) {
        next(error);
    }
};
exports.getCampaigns = getCampaigns;
