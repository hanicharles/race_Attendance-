import { authAction, executeDbQuery } from "@/lib/sqlite-service";

const listeners = new Set<(event: string, session: any) => void>();

class SupabaseQueryBuilder {
  private tableName: string;
  private selectCols: string = "*";
  private filters: Array<{ type: string; col: string; val: any }> = [];
  private orderCol: string | null = null;
  private orderAscending: boolean = true;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(cols: string = "*") {
    this.selectCols = cols;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ type: "eq", col, val });
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push({ type: "gte", col, val });
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push({ type: "lte", col, val });
    return this;
  }

  ilike(col: string, val: any) {
    this.filters.push({ type: "ilike", col, val });
    return this;
  }

  is(col: string, val: any) {
    this.filters.push({ type: "is", col, val });
    return this;
  }

  in(col: string, val: any[]) {
    this.filters.push({ type: "in", col, val });
    return this;
  }

  order(col: string, options?: { ascending: boolean }) {
    this.orderCol = col;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
      const res = await executeDbQuery({
        data: {
          action: "select",
          table: this.tableName,
          select: this.selectCols,
          filters: this.filters,
          orderCol: this.orderCol,
          orderAscending: this.orderAscending,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle,
          token,
        }
      });
      return onfulfilled ? onfulfilled(res) : res;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  insert(data: any) {
    return {
      then: async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
          const res = await executeDbQuery({
            data: {
              action: "insert",
              table: this.tableName,
              data,
              token,
            }
          });
          return onfulfilled ? onfulfilled(res) : res;
        } catch (err) {
          if (onrejected) return onrejected(err);
          throw err;
        }
      }
    };
  }

  update(data: any) {
    return {
      eq: (col: string, val: any) => {
        this.filters.push({ type: "eq", col, val });
        return {
          then: async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
            try {
              const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
              const res = await executeDbQuery({
                data: {
                  action: "update",
                  table: this.tableName,
                  data,
                  filters: this.filters,
                  token,
                }
              });
              return onfulfilled ? onfulfilled(res) : res;
            } catch (err) {
              if (onrejected) return onrejected(err);
              throw err;
            }
          }
        };
      }
    };
  }

  delete() {
    return {
      eq: (col: string, val: any) => {
        this.filters.push({ type: "eq", col, val });
        return {
          then: async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
            try {
              const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
              const res = await executeDbQuery({
                data: {
                  action: "delete",
                  table: this.tableName,
                  filters: this.filters,
                  token,
                }
              });
              return onfulfilled ? onfulfilled(res) : res;
            } catch (err) {
              if (onrejected) return onrejected(err);
              throw err;
            }
          }
        };
      }
    };
  }

  upsert(data: any, options?: any) {
    return {
      then: async (onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
        try {
          const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
          const res = await executeDbQuery({
            data: {
              action: "upsert",
              table: this.tableName,
              data,
              token,
            }
          });
          return onfulfilled ? onfulfilled(res) : res;
        } catch (err) {
          if (onrejected) return onrejected(err);
          throw err;
        }
      }
    };
  }
}

export const supabase = {
  from(tableName: string) {
    return new SupabaseQueryBuilder(tableName);
  },

  auth: {
    async signUp({ email, password, options }: any) {
      const res = await authAction({
        data: {
          action: "signUp",
          email,
          password,
          fullName: options?.data?.full_name,
          role: options?.data?.role,
        }
      });

      if (!res.error && res.session) {
        if (typeof window !== "undefined") {
          localStorage.setItem("sqlite-session-token", res.session.access_token);
          localStorage.setItem("sqlite-session-user", JSON.stringify(res.session.user));
        }
        listeners.forEach(cb => cb("SIGNED_IN", res.session));
      }
      return res;
    },

    async signInWithPassword({ email, password }: any) {
      const res = await authAction({
        data: {
          action: "signIn",
          email,
          password,
        }
      });

      if (!res.error && res.session) {
        if (typeof window !== "undefined") {
          localStorage.setItem("sqlite-session-token", res.session.access_token);
          localStorage.setItem("sqlite-session-user", JSON.stringify(res.session.user));
        }
        listeners.forEach(cb => cb("SIGNED_IN", res.session));
      }
      return res;
    },

    async signOut() {
      const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
      await authAction({ data: { action: "signOut", token } });
      if (typeof window !== "undefined") {
        localStorage.removeItem("sqlite-session-token");
        localStorage.removeItem("sqlite-session-user");
      }
      listeners.forEach(cb => cb("SIGNED_OUT", null));
      return { error: null };
    },

    async getSession() {
      if (typeof window === "undefined") {
        return { data: { session: null }, error: null };
      }
      const token = localStorage.getItem("sqlite-session-token");
      const userRaw = localStorage.getItem("sqlite-session-user");
      if (!token || !userRaw) return { data: { session: null }, error: null };
      return {
        data: {
          session: {
            access_token: token,
            user: JSON.parse(userRaw),
          }
        },
        error: null,
      };
    },

    async getUser() {
      if (typeof window === "undefined") {
        return { data: { user: null }, error: new Error("No window object") };
      }
      const token = localStorage.getItem("sqlite-session-token");
      const userRaw = localStorage.getItem("sqlite-session-user");
      if (!token || !userRaw) return { data: { user: null }, error: new Error("No session") };
      
      const res = await authAction({ data: { action: "getUser", token } });
      if (res.error) {
        localStorage.removeItem("sqlite-session-token");
        localStorage.removeItem("sqlite-session-user");
        return { data: { user: null }, error: res.error };
      }
      return { data: { user: res.user }, error: null };
    },

    async updateUser({ password }: any) {
      const token = typeof window !== "undefined" ? localStorage.getItem("sqlite-session-token") : undefined;
      return await authAction({ data: { action: "updateUser", password, token } });
    },

    onAuthStateChange(callback: any) {
      listeners.add(callback);
      this.getSession().then(({ data }) => {
        callback(data.session ? "SIGNED_IN" : "SIGNED_OUT", data.session);
      });
      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            }
          }
        }
      };
    }
  }
};
