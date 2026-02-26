import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DbTransaction {
  id: string;
  date: string;
  team: string;
  income_expense: string;
  type: string;
  person: string;
  note: string;
  amount: number;
  transaction_id: string;
  linked_wallet: string | null;
  category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  month_id: string | null;
  source_type: string | null;
  settlement_status: string | null;
  settled_amount: number | null;
  settlement_month_id: string | null;
  original_transaction_id: string | null;
}

const FIVE_MINUTES = 5 * 60 * 1000;

export function useTransactions(monthId?: string | null) {
  return useQuery({
    queryKey: ["transactions", monthId],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*").order("created_at", { ascending: false });
      if (monthId) {
        query = query.eq("month_id", monthId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DbTransaction[];
    },
    enabled: !!monthId,
    staleTime: FIVE_MINUTES,
  });
}

export function useTransactionsByWallet(wallet: string, monthId?: string | null) {
  return useQuery({
    queryKey: ["transactions", wallet, monthId],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*").eq("team", wallet).order("created_at", { ascending: false });
      if (monthId) {
        query = query.eq("month_id", monthId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DbTransaction[];
    },
    enabled: !!monthId,
    staleTime: FIVE_MINUTES,
  });
}

export interface AddTransactionInput {
  date: string;
  team: string;
  income_expense: string;
  type: string;
  person: string;
  note: string;
  amount: number;
  transaction_id: string;
  linked_wallet?: string | null;
  category?: string | null;
  month_id?: string | null;
  source_type?: string | null;
  settlement_status?: string | null;
}

function getInternalCounterpartMeta(transaction: DbTransaction) {
  if (transaction.type !== "Internal") return null;

  const isMirror = transaction.transaction_id.endsWith("-M");
  const counterpartTxId = isMirror
    ? transaction.transaction_id.slice(0, -2)
    : `${transaction.transaction_id}-M`;

  if (!counterpartTxId) return null;

  return {
    counterpartTxId,
    counterpartAmount: isMirror ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
    counterpartTeam: transaction.linked_wallet,
    counterpartLinkedWallet: transaction.team,
  };
}

async function findInternalCounterpartId(transaction: DbTransaction): Promise<string | null> {
  const counterpart = getInternalCounterpartMeta(transaction);
  if (!counterpart) return null;

  const filterSets: Array<Array<[string, unknown]>> = [];

  const strictFilters: Array<[string, unknown]> = [
    ["transaction_id", counterpart.counterpartTxId],
    ["type", "Internal"],
    ["income_expense", "Internal"],
    ["date", transaction.date],
    ["amount", counterpart.counterpartAmount],
    ["month_id", transaction.month_id ?? null],
  ];
  if (counterpart.counterpartTeam) strictFilters.push(["team", counterpart.counterpartTeam]);
  if (counterpart.counterpartLinkedWallet) strictFilters.push(["linked_wallet", counterpart.counterpartLinkedWallet]);
  filterSets.push(strictFilters);

  const mediumFilters: Array<[string, unknown]> = [
    ["transaction_id", counterpart.counterpartTxId],
    ["type", "Internal"],
    ["income_expense", "Internal"],
    ["amount", counterpart.counterpartAmount],
    ["month_id", transaction.month_id ?? null],
  ];
  if (counterpart.counterpartTeam) mediumFilters.push(["team", counterpart.counterpartTeam]);
  if (counterpart.counterpartLinkedWallet) mediumFilters.push(["linked_wallet", counterpart.counterpartLinkedWallet]);
  filterSets.push(mediumFilters);

  filterSets.push([
    ["transaction_id", counterpart.counterpartTxId],
    ["type", "Internal"],
    ["income_expense", "Internal"],
  ]);

  for (const filters of filterSets) {
    let query = supabase.from("transactions").select("id");
    for (const [column, value] of filters) {
      query = query.eq(column, value);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  return null;
}

function findInternalCounterpartInCache(
  transactions: DbTransaction[],
  transaction: DbTransaction,
): DbTransaction | undefined {
  const counterpart = getInternalCounterpartMeta(transaction);
  if (!counterpart) return undefined;

  const strictMatch = transactions.find((row) =>
    row.id !== transaction.id &&
    row.type === "Internal" &&
    row.income_expense === "Internal" &&
    row.transaction_id === counterpart.counterpartTxId &&
    row.date === transaction.date &&
    row.month_id === transaction.month_id &&
    row.amount === counterpart.counterpartAmount &&
    row.team === counterpart.counterpartTeam &&
    row.linked_wallet === counterpart.counterpartLinkedWallet
  );
  if (strictMatch) return strictMatch;

  const mediumMatch = transactions.find((row) =>
    row.id !== transaction.id &&
    row.type === "Internal" &&
    row.income_expense === "Internal" &&
    row.transaction_id === counterpart.counterpartTxId &&
    row.month_id === transaction.month_id &&
    row.amount === counterpart.counterpartAmount &&
    row.team === counterpart.counterpartTeam &&
    row.linked_wallet === counterpart.counterpartLinkedWallet
  );
  if (mediumMatch) return mediumMatch;

  return transactions.find((row) =>
    row.id !== transaction.id &&
    row.type === "Internal" &&
    row.income_expense === "Internal" &&
    row.transaction_id === counterpart.counterpartTxId
  );
}

export function useAddTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: AddTransactionInput) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          date: input.date,
          team: input.team,
          income_expense: input.income_expense,
          type: input.type,
          person: input.person,
          note: input.note,
          amount: input.amount,
          transaction_id: input.transaction_id,
          linked_wallet: input.linked_wallet ?? null,
          category: input.category ?? null,
          month_id: input.month_id ?? null,
          source_type: input.source_type ?? null,
          settlement_status: input.settlement_status ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      // Mirror internal transfers
      if (input.type === "Internal" && input.linked_wallet) {
        const { error: mirrorError } = await supabase.from("transactions").insert({
          date: input.date,
          team: input.linked_wallet,
          income_expense: "Internal",
          type: "Internal",
          person: input.team === "CSB" ? input.linked_wallet : input.team,
          note: `Received from ${input.team === "CSB" ? "CSB Wallet" : input.team}`,
          amount: Math.abs(input.amount),
          transaction_id: `${input.transaction_id}-M`,
          linked_wallet: input.team,
          month_id: input.month_id ?? null,
        });
        if (mirrorError) throw mirrorError;
      }

      return data;
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transactions"] });

      // Snapshot previous data
      const prevAll = queryClient.getQueryData<DbTransaction[]>(["transactions", input.month_id]);
      const prevWallet = queryClient.getQueryData<DbTransaction[]>(["transactions", input.team, input.month_id]);

      // Create optimistic transaction
      const optimistic: DbTransaction = {
        id: `temp-${Date.now()}`,
        date: input.date,
        team: input.team,
        income_expense: input.income_expense,
        type: input.type,
        person: input.person,
        note: input.note,
        amount: input.amount,
        transaction_id: input.transaction_id,
        linked_wallet: input.linked_wallet ?? null,
        category: input.category ?? null,
        created_by: null,
        created_at: "",
        updated_at: "",
        month_id: input.month_id ?? null,
        source_type: input.source_type ?? null,
        settlement_status: input.settlement_status ?? null,
        settled_amount: null,
        settlement_month_id: null,
        original_transaction_id: null,
      };

      if (prevAll) {
        queryClient.setQueryData<DbTransaction[]>(["transactions", input.month_id], [optimistic, ...prevAll]);
      }
      if (prevWallet) {
        queryClient.setQueryData<DbTransaction[]>(["transactions", input.team, input.month_id], [optimistic, ...prevWallet]);
      }

      return { prevAll, prevWallet, monthId: input.month_id, team: input.team };
    },
    onSuccess: (_data, _input, context) => {
      // Invalidate to get real server data (replaces optimistic)
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Transaction added", description: "Saved to database." });
    },
    onError: (err: Error, input, context) => {
      // Rollback optimistic update
      if (context?.prevAll !== undefined) {
        queryClient.setQueryData(["transactions", context.monthId], context.prevAll);
      }
      if (context?.prevWallet !== undefined) {
        queryClient.setQueryData(["transactions", context.team, context.monthId], context.prevWallet);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { id: string; updates: Partial<AddTransactionInput> }) => {
      const { error } = await supabase
        .from("transactions")
        .update({
          ...(input.updates.date !== undefined && { date: input.updates.date }),
          ...(input.updates.income_expense !== undefined && { income_expense: input.updates.income_expense }),
          ...(input.updates.type !== undefined && { type: input.updates.type }),
          ...(input.updates.person !== undefined && { person: input.updates.person }),
          ...(input.updates.note !== undefined && { note: input.updates.note }),
          ...(input.updates.amount !== undefined && { amount: input.updates.amount }),
          ...(input.updates.category !== undefined && { category: input.updates.category }),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });

      // Optimistically update all matching caches
      const allCaches = queryClient.getQueriesData<DbTransaction[]>({ queryKey: ["transactions"] });
      const snapshots: [readonly unknown[], DbTransaction[] | undefined][] = [];

      for (const [key, data] of allCaches) {
        if (!data) continue;
        snapshots.push([key, data]);
        queryClient.setQueryData<DbTransaction[]>(key as any, data.map(t =>
          t.id === input.id ? { ...t, ...input.updates } as DbTransaction : t
        ));
      }

      return { snapshots };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Transaction updated" });
    },
    onError: (err: Error, _input, context) => {
      // Rollback all caches
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key as any, data);
        }
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { transaction: DbTransaction }) => {
      const { transaction } = input;

      // Delete any Settlement Adjustment transactions that reference this one
      await supabase.from("transactions").delete().eq("original_transaction_id", transaction.id);

      // Delete main transaction
      const { error } = await supabase.from("transactions").delete().eq("id", transaction.id);
      if (error) throw error;

      if (transaction.type === "Internal") {
        // Delete only one matched counterpart row to avoid wiping duplicates with same transaction_id.
        const counterpartId = await findInternalCounterpartId(transaction);
        if (counterpartId) {
          const { error: counterpartError } = await supabase
            .from("transactions")
            .delete()
            .eq("id", counterpartId);
          if (counterpartError) throw counterpartError;
        }
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const { transaction } = input;

      const allCaches = queryClient.getQueriesData<DbTransaction[]>({ queryKey: ["transactions"] });
      const snapshots: [readonly unknown[], DbTransaction[] | undefined][] = [];

      for (const [key, data] of allCaches) {
        if (!data) continue;
        const counterpart = findInternalCounterpartInCache(data, transaction);
        snapshots.push([key, data]);
        queryClient.setQueryData<DbTransaction[]>(key as any,
          data.filter((t) => t.id !== transaction.id && t.id !== counterpart?.id)
        );
      }

      return { snapshots };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast({ title: "Transaction deleted" });
    },
    onError: (err: Error, _input, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          queryClient.setQueryData(key as any, data);
        }
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
