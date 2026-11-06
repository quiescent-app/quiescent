import { eq } from "drizzle-orm";

import { database, type Database } from "../db/client.js";
import { users, type User } from "../schema/user.schema.js";

export class UserModel {
  constructor(private readonly db: Database = database) {}

  async create(input: { email: string; password: string }): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values({ email: input.email, password: input.password })
      .returning();

    if (!user) throw new Error("User insert did not return a record");
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }
}

export const userModel = new UserModel(database);
