import { Request, Response, NextFunction } from "express";
import { PrismaClient, Role, Prisma } from "@prisma/client";
import { z } from "zod";
import NodeCache from "node-cache";
import { AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().nullable().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

type CommentWithAuthor = {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
  };
  replies?: CommentWithAuthor[];
};

// Get comments for a post
export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Try to get from cache first
    const cacheKey = `post-comments-${postId}-${page}-${limit}`;
    const cachedComments = cache.get<{
      comments: CommentWithAuthor[];
      pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(cacheKey);

    if (cachedComments) {
      console.log("Cache hit for comments:", cacheKey);
      return res.json({
        status: "success",
        data: cachedComments,
      });
    }

    console.log("Cache miss for comments:", cacheKey);
    console.log("Fetching comments for post:", postId);

    // Get all comments for this post with their replies
    const allComments = await prisma.comment.findMany({
      where: {
        postId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Organize comments into a tree structure
    const commentMap = new Map<string, CommentWithAuthor>();
    const topLevelComments: CommentWithAuthor[] = [];

    // First pass: create comment objects with empty replies array
    allComments.forEach((comment) => {
      commentMap.set(comment.id, {
        ...comment,
        replies: [],
      });
    });

    // Second pass: organize into tree structure
    allComments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parentId) {
        // This is a reply, add it to its parent's replies
        const parentComment = commentMap.get(comment.parentId);
        if (parentComment) {
          parentComment.replies!.push(commentWithReplies);
        }
      } else {
        // This is a top-level comment
        topLevelComments.push(commentWithReplies);
      }
    });

    // Sort top-level comments by creation date (newest first)
    topLevelComments.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination to top-level comments
    const paginatedComments = topLevelComments.slice(
      skip,
      skip + Number(limit)
    );
    const total = topLevelComments.length;

    console.log("Found comments:", paginatedComments.length);
    console.log("Total comments:", total);

    const totalPages = Math.ceil(total / Number(limit));
    const result = {
      comments: paginatedComments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages,
      },
    };

    // Cache the result
    cache.set(cacheKey, result);
    console.log("Cached comments for key:", cacheKey);

    res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    next(error);
  }
};

// Helper function to invalidate all comment caches for a post
const invalidateCommentCache = (postId: string) => {
  // Get all keys in the cache
  const keys = cache.keys();
  // Find all keys that start with post-comments-${postId}
  const commentKeys = keys.filter((key) =>
    key.startsWith(`post-comments-${postId}`)
  );
  // Delete all matching keys
  commentKeys.forEach((key) => {
    console.log("Invalidating cache key:", key);
    cache.del(key);
  });
};

// Create a new comment
export const createComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Create comment request body:", req.body);
    const { postId } = req.params;
    console.log("Post ID:", postId);

    // Validate and get the comment data
    const validatedData = createCommentSchema.parse(req.body);
    console.log("Validated comment data:", validatedData);

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "You must be logged in to comment",
      });
    }

    // Check if the post exists and is published
    const post = await prisma.blogPost.findFirst({
      where: {
        id: postId,
        published: true,
      },
    });

    if (!post) {
      return res.status(404).json({
        status: "error",
        message: "Post not found or not published",
      });
    }

    // If this is a reply, verify the parent comment exists
    if (validatedData.parentId) {
      const parentComment = await prisma.comment.findFirst({
        where: {
          id: validatedData.parentId,
          postId,
        },
      });

      if (!parentComment) {
        return res.status(404).json({
          status: "error",
          message: "Parent comment not found",
        });
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const result = await tx.comment.create({
        data: {
          content: validatedData.content,
          postId,
          authorId: userId,
          parentId: validatedData.parentId,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          replies: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });
      return result as CommentWithAuthor;
    });

    // Invalidate all comment caches for this post
    invalidateCommentCache(postId);

    res.status(201).json({
      status: "success",
      data: { comment },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    next(error);
  }
};

// Update a comment
export const updateComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { commentId } = req.params;
    const { content } = updateCommentSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "You must be logged in to update a comment",
      });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({
        status: "error",
        message: "Comment not found",
      });
    }

    // Only the author or an admin can update the comment
    if (comment.authorId !== userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "You can only update your own comments",
      });
    }

    const updatedComment = await prisma.$transaction(async (tx) => {
      const result = await tx.comment.update({
        where: { id: commentId },
        data: { content },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return result as CommentWithAuthor;
    });

    // Invalidate cache
    invalidateCommentCache(comment.postId);

    res.json({
      status: "success",
      data: { comment: updatedComment },
    });
  } catch (error) {
    next(error);
  }
};

// Delete a comment
export const deleteComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { commentId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "You must be logged in to delete a comment",
      });
    }

    // Get the comment and its post ID before deleting
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        replies: true,
      },
    });

    if (!comment) {
      return res.status(404).json({
        status: "error",
        message: "Comment not found",
      });
    }

    // Only the author or an admin can delete the comment
    if (comment.authorId !== userId && req.user?.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own comments",
      });
    }

    await prisma.$transaction(async (tx) => {
      // First delete all replies to this comment
      if (comment.replies.length > 0) {
        await tx.comment.deleteMany({
          where: {
            parentId: commentId,
          },
        });
      }

      // Then delete the comment itself
      await tx.comment.delete({
        where: { id: commentId },
      });
    });

    // Invalidate all comment caches for this post
    invalidateCommentCache(comment.postId);

    res.json({
      status: "success",
      message: "Comment and its replies deleted successfully",
      data: {
        deletedCommentId: commentId,
        postId: comment.postId,
        parentId: comment.parentId,
      },
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    next(error);
  }
};
