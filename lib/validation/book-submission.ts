import { z } from "zod";

// ISBN validation regex (supports ISBN-10 and ISBN-13)
const isbnRegex =
  /^(?:ISBN(?:-1[03])?:?\s*)?(?=[0-9X]{10}$|(?=(?:[0-9]+[-\s]){3})[-\s0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[-\s]){4})[-\s0-9]{17}$)(?:97[89][-\s]?)?[0-9]{1,5}[-\s]?[0-9]+[-\s]?[0-9]+[-\s]?[0-9X]$/;

export const createBookSubmissionSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(500, "Title must be less than 500 characters")
    .trim(),
  author: z
    .string()
    .min(1, "Author is required")
    .max(200, "Author must be less than 200 characters")
    .trim(),
  isbn: z
    .string()
    .regex(isbnRegex, "Invalid ISBN format")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  coverUrl: z.string().url("Invalid cover URL").optional().or(z.literal("")),
  genres: z
    .array(z.string())
    .max(10, "Maximum 10 genres allowed")
    .default([]),
  publishedDate: z.string().optional(),
  pageCount: z
    .number()
    .int("Page count must be a whole number")
    .positive("Page count must be positive")
    .max(50000, "Page count seems too high")
    .optional(),
  // External IDs for better cover resolution and deduplication
  googleBooksId: z.string().optional(),
  openLibraryId: z.string().optional(),
  openLibraryCoverId: z.number().int().positive().optional(),
  coverSource: z.enum(["google", "openlibrary", "user", "other"]).optional(),
});

export const updateBookSubmissionSchema = createBookSubmissionSchema.partial();

export const submissionIdSchema = z.string().uuid("Invalid submission ID");

export const moderateBookSubmissionSchema = z.object({
  submissionId: z.string().uuid("Invalid submission ID"),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
});

export type CreateBookSubmissionInput = z.infer<
  typeof createBookSubmissionSchema
>;
export type UpdateBookSubmissionInput = z.infer<
  typeof updateBookSubmissionSchema
>;
export type ModerateBookSubmissionInput = z.infer<
  typeof moderateBookSubmissionSchema
>;

