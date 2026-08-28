import { z } from "zod";

export const TicketStatus = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED"
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT"
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketSource = {
  MANUAL: "MANUAL",
  TELEGRAM: "TELEGRAM"
} as const;
export type TicketSource = (typeof TicketSource)[keyof typeof TicketSource];

export const SenderType = {
  USER: "USER",
  AGENT: "AGENT",
  AI: "AI"
} as const;
export type SenderType = (typeof SenderType)[keyof typeof SenderType];

export const TicketStatusSchema = z.enum([
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED
]);

export const TicketPrioritySchema = z.enum([
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.URGENT
]);

export const TicketSourceSchema = z.enum([
  TicketSource.MANUAL,
  TicketSource.TELEGRAM
]);

export const SenderTypeSchema = z.enum([
  SenderType.USER,
  SenderType.AGENT,
  SenderType.AI
]);

export const CreateTicketDtoSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(5000),
  category: z.string().min(1).max(100).optional(),
  priority: TicketPrioritySchema.default(TicketPriority.MEDIUM),
  source: TicketSourceSchema.default(TicketSource.MANUAL)
});
export type CreateTicketDto = z.infer<typeof CreateTicketDtoSchema>;

export const TicketMessageDtoSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(10_000),
  senderType: SenderTypeSchema
});
export type TicketMessageDto = z.infer<typeof TicketMessageDtoSchema>;

export const UpdateTicketStatusDtoSchema = z.object({
  ticketId: z.string().min(1),
  status: TicketStatusSchema
});
export type UpdateTicketStatusDto = z.infer<typeof UpdateTicketStatusDtoSchema>;

export const ApiResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional()
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
