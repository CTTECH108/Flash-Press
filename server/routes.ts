import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { insertUserSchema, insertCommentSchema, insertLikeSchema, insertBookmarkSchema } from "@shared/schema";
import { summarizeText, detectFakeNews, chatWithAI } from "./services/openai";
import { fetchNews, searchNews } from "./services/newsapi";

const JWT_SECRET = process.env.SESSION_SECRET || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30";

// Middleware for authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // News routes
  app.get("/api/news", async (req, res) => {
    try {
      const { category } = req.query as { category?: string };
      
      // Try to get from external API first
      const externalNews = await fetchNews(category);
      
      // Convert external news to our format and store
      for (const article of externalNews) {
        try {
          await storage.createArticle({
            title: article.title,
            description: article.description || null,
            content: article.content || null,
            url: article.link,
            imageUrl: article.image_url || null,
            category: article.category?.[0] || 'general',
            source: article.source_id,
            publishedAt: article.pubDate ? new Date(article.pubDate) : null
          });
        } catch (error) {
          // Skip duplicate articles
        }
      }
      
      // Get articles from storage
      const articles = await storage.getArticles(category);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ message: "Failed to fetch news" });
    }
  });

  app.get("/api/news/search", async (req, res) => {
    try {
      const { q } = req.query as { q?: string };
      
      if (!q) {
        return res.status(400).json({ message: "Search query required" });
      }

      const articles = await storage.searchArticles(q);
      res.json(articles);
    } catch (error) {
      console.error("Error searching news:", error);
      res.status(500).json({ message: "Failed to search news" });
    }
  });

  // AI routes
  app.post("/api/summarize/text", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text content is required" });
      }

      const summary = await summarizeText(text);
      res.json({ summary });
    } catch (error) {
      console.error("Error summarizing text:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to summarize text" });
    }
  });

  app.post("/api/fakecheck", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text content is required" });
      }

      const result = await detectFakeNews(text);
      res.json(result);
    } catch (error) {
      console.error("Error checking fake news:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to check news authenticity" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Message is required" });
      }

      const response = await chatWithAI(message, context);
      res.json({ response });
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get AI response" });
    }
  });

  // Authentication routes
  app.post("/api/user/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email) || 
                          await storage.getUserByUsername(userData.username);
      
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });

      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email }, 
        token 
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/user/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = await storage.getUserByUsername(username) || await storage.getUserByEmail(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        user: { id: user.id, username: user.username, email: user.email }, 
        token 
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Article engagement routes
  app.post("/api/articles/:id/like", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Check if already liked
      const existingLike = await storage.getUserLike(userId, id);
      
      if (existingLike) {
        await storage.deleteLike(userId, id);
        res.json({ liked: false });
      } else {
        await storage.createLike({ userId, articleId: id });
        res.json({ liked: true });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  app.get("/api/articles/:id/likes", async (req, res) => {
    try {
      const { id } = req.params;
      const likes = await storage.getLikesByArticle(id);
      res.json({ count: likes.length, likes });
    } catch (error) {
      console.error("Error fetching likes:", error);
      res.status(500).json({ message: "Failed to fetch likes" });
    }
  });

  app.post("/api/articles/:id/comment", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const commentData = insertCommentSchema.parse({ ...req.body, userId, articleId: id });

      const comment = await storage.createComment(commentData);
      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.get("/api/articles/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;
      const comments = await storage.getCommentsByArticle(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // TNPSC routes
  app.get("/api/tnpsc/resources", async (req, res) => {
    try {
      const { type, category } = req.query as { type?: string; category?: string };
      const resources = await storage.getTNPSCResources(type, category);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching TNPSC resources:", error);
      res.status(500).json({ message: "Failed to fetch TNPSC resources" });
    }
  });

  app.get("/api/tnpsc/resources/search", async (req, res) => {
    try {
      const { q } = req.query as { q?: string };
      
      if (!q) {
        return res.status(400).json({ message: "Search query required" });
      }

      const resources = await storage.searchTNPSCResources(q);
      res.json(resources);
    } catch (error) {
      console.error("Error searching TNPSC resources:", error);
      res.status(500).json({ message: "Failed to search TNPSC resources" });
    }
  });

  app.post("/api/user/bookmark", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const bookmarkData = insertBookmarkSchema.parse({ ...req.body, userId });

      const bookmark = await storage.createBookmark(bookmarkData);
      res.json(bookmark);
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({ message: "Failed to create bookmark" });
    }
  });

  app.get("/api/user/bookmarks", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
