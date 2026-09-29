"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createUser,
  toggleUserActive,
  updateUser,
  type UserFormState,
} from "@/app/(app)/admin/usuarios/actions";
import { Field, FormError, FormOk, Input, Section, Select, SubmitButton } from "./form";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

function EditUserForm({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [state, formAction] = useActionState<UserFormState, FormData>(
    updateUser,
    {},
  );

  return (
    <form
      action={formAction}
      className="mt-4 space-y-4 border-t border-slate-100 pt-4"
    >
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *">
          <Input name="name" defaultValue={user.name} required />
        </Field>
        <Field label="E-mail de login *">
          <Input name="email" type="email" defaultValue={user.email} required />
        </Field>
        <Field
          label="Nova senha"
          hint="Deixe em branco para manter a atual. Mínimo de 8 caracteres."
        >
          <Input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field
          label="Perfil"
          hint={
            isSelf
              ? "Você não pode tirar o próprio perfil de administrador."
              : undefined
          }
        >
          <Select name="role" defaultValue={user.role} disabled={isSelf}>
            <option value="MEMBRO">Membro</option>
            <option value="ADMIN">Administrador</option>
          </Select>
        </Field>
      </div>

      <FormError message={state.error} />
      <FormOk message={state.ok} />

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
      </div>
    </form>
  );
}

function UserCard({
  user,
  isSelf,
}: {
  user: UserRow;
  isSelf: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        user.active ? "border-slate-200" : "border-slate-200 bg-slate-50/60"
      } ${pending ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name}
            </p>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                user.role === "ADMIN"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {user.role}
            </span>
            {!user.active ? (
              <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                INATIVO
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            {aberto ? "Fechar" : "Editar"}
          </button>
          <button
            type="button"
            disabled={isSelf || pending}
            onClick={() =>
              startTransition(() => {
                void toggleUserActive(user.id, !user.active);
              })
            }
            title={isSelf ? "Você não pode desativar a própria conta." : ""}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {user.active ? "Desativar" : "Reativar"}
          </button>
        </div>
      </div>

      {aberto ? <EditUserForm user={user} isSelf={isSelf} /> : null}
    </li>
  );
}

export default function UsersPanel({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [state, formAction] = useActionState<UserFormState, FormData>(
    createUser,
    {},
  );

  return (
    <div className="space-y-4">
      <Section
        title="Criar novo acesso"
        description="A senha é definida aqui e informada ao usuário por um canal seguro."
      >
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *">
              <Input name="name" required />
            </Field>
            <Field label="E-mail *">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Senha inicial *" hint="Mínimo de 8 caracteres.">
              <Input name="password" type="password" minLength={8} required />
            </Field>
            <Field label="Perfil">
              <Select name="role" defaultValue="MEMBRO">
                <option value="MEMBRO">Membro</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </Field>
          </div>

          <FormError message={state.error} />
          <FormOk message={state.ok} />

          <div className="flex justify-end">
            <SubmitButton pendingLabel="Criando…">Criar acesso</SubmitButton>
          </div>
        </form>
      </Section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Acessos existentes ({users.length})
        </h2>
        <ul className="space-y-2">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isSelf={u.id === currentUserId}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
