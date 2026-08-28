import type { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { clipUntrustedText } from "$lib/server/agent-policy";
import { listKnowledge } from "$lib/server/knowledge-service";

export type AgentToolContext = {
  database: D1Database;
  userId: string;
};

export type PreparedTicketDraft = {
  title: string;
  location: string;
  problem: string;
  categoryId: string;
  categoryName: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

type AgentToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const SearchKnowledgeArgs = z.object({
  query: z.string().trim().min(2).max(160)
});

const TicketStatusArgs = z.object({
  code: z.string().trim().toUpperCase().regex(/^TKT-\d{4,}$/).optional()
});


const PrepareTicketDraftArgs = z.object({
  title: z.string().trim().min(3).max(120),
  location: z.string().trim().min(2).max(160),
  problem: z.string().trim().min(10).max(1_000),
  categoryName: z.string().trim().min(2).max(100),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
});
export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    type: "function",
    name: "search_knowledge",
    description: "Search active IT helpdesk knowledge articles for the linked user.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Short IT support search query" } },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "get_my_ticket_status",
    description: "Get active tickets belonging only to the linked Telegram user.",
    parameters: {
      type: "object",
      properties: { code: { type: "string", description: "Optional ticket code such as TKT-0001" } }
    }
  },
  {
    type: "function",
    name: "list_ticket_categories",
    description: "List valid helpdesk categories for classifying a new ticket.",
    parameters: { type: "object", properties: {} }
  },
  {
    type: "function",
    name: "prepare_ticket_draft",
    description: "Prepare a validated ticket draft after collecting location, problem, category, and priority. This does not create or modify a ticket.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short ticket title" },
        location: { type: "string", description: "Office, building, room, or work location" },
        problem: { type: "string", description: "Detailed user problem" },
        categoryName: { type: "string", description: "Exact category name from list_ticket_categories" },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }
      },
      required: ["title", "location", "problem", "categoryName", "priority"]
    }
  }
];

async function searchKnowledge(database: D1Database, args: unknown) {
  const { query } = SearchKnowledgeArgs.parse(args);
  const articles = await listKnowledge(database, query);
  return {
    trust: "untrusted_knowledge_data",
    results: articles.slice(0, 5).map((article) => ({
      title: clipUntrustedText(article.title, 160),
      body: clipUntrustedText(article.body),
      keywords: clipUntrustedText(article.keywords, 240),
      category: article.category?.name ? clipUntrustedText(article.category.name, 100) : null
    }))
  };
}

async function getMyTicketStatus(database: D1Database, userId: string, args: unknown) {
  const { code } = TicketStatusArgs.parse(args);
  const codeClause = code ? " AND t.code = ?" : "";
  const values = code ? [userId, code] : [userId];
  const result = await database
    .prepare(
      `SELECT t.code, t.title, t.status, t.priority, t.createdAt, c.name AS categoryName
       FROM Ticket t JOIN Category c ON c.id = t.categoryId
       WHERE t.userId = ? AND t.status <> 'CLOSED'${codeClause}
       ORDER BY t.createdAt DESC LIMIT 5`
    )
    .bind(...values)
    .all<{
      code: string;
      title: string;
      status: string;
      priority: string;
      createdAt: string;
      categoryName: string;
    }>();

  return {
    trust: "untrusted_ticket_data",
    tickets: result.results.map((ticket) => ({
      code: ticket.code,
      title: clipUntrustedText(ticket.title, 160),
      status: ticket.status,
      priority: ticket.priority,
      category: clipUntrustedText(ticket.categoryName, 100),
      createdAt: ticket.createdAt
    }))
  };
}

async function listTicketCategories(database: D1Database) {
  const result = await database.prepare("SELECT id, name FROM Category ORDER BY name ASC").all<{ id: string; name: string }>();
  return {
    trust: "untrusted_category_data",
    categories: result.results.map((category) => ({ id: category.id, name: clipUntrustedText(category.name, 100) }))
  };
}

async function prepareTicketDraft(database: D1Database, args: unknown): Promise<PreparedTicketDraft | { error: string; availableCategories: string[] }> {
  const parsed = PrepareTicketDraftArgs.parse(args);
  const category = await database
    .prepare("SELECT id, name FROM Category WHERE LOWER(name) = LOWER(?) LIMIT 1")
    .bind(parsed.categoryName)
    .first<{ id: string; name: string }>();
  if (!category) {
    const categories = await listTicketCategories(database);
    return {
      error: "CATEGORY_NOT_FOUND",
      availableCategories: categories.categories.map((item) => item.name)
    };
  }
  return {
    title: parsed.title,
    location: parsed.location,
    problem: parsed.problem,
    categoryId: category.id,
    categoryName: category.name,
    priority: parsed.priority
  };
}


export async function executeAgentTool(name: string, args: unknown, context: AgentToolContext) {
  switch (name) {
    case "search_knowledge":
      return searchKnowledge(context.database, args);
    case "get_my_ticket_status":
      return getMyTicketStatus(context.database, context.userId, args);
    case "list_ticket_categories":
      return listTicketCategories(context.database);
    case "prepare_ticket_draft":
      return prepareTicketDraft(context.database, args);
    default:
      throw new Error(`Unknown agent tool: ${name}`);
  }
}
