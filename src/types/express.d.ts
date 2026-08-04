// Populated by requireAuth. Optional because most requests never pass through it.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number };
    }
  }
}

export {};
