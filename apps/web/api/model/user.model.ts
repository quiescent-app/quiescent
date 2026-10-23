import { eq } from "drizzle-orm";

import type { Database } from "./db/client.js";
import { users, UserRecord} from "./schema/user.schema.js";

export class UserModel {
  constructor(private readonly database: Database) {}

  async create(input: {email: string, password: string}): Promise<UserRecord> {
    const [user] = await this.database
      .insert(users)
      .values({ email: input.email, password: input.password })
      .returning();

    if (!user) throw new Error("User insert did not return a record");
    return user;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }
}
