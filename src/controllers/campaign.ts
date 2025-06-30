import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/error";

const prisma = new PrismaClient();

export const createCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, subject, template } = req.body;
    if (!name || !subject || !template) {
      throw new AppError(400, "All fields are required");
    }
    const campaign = await prisma.campaign.create({
      data: { name, subject, template },
    });
    res.status(201).json({ status: "success", data: { campaign } });
  } catch (error) {
    next(error);
  }
};

export const getCampaigns = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ status: "success", data: { campaigns } });
  } catch (error) {
    next(error);
  }
};
