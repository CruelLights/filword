"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message);
      } else {
        const result = await signUp.email({ email, password, name });
        if (result.error) throw new Error(result.error.message);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push("/lobby");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold text-white">
            Фил<span className="text-blue-500">ворд</span>
          </Link>
          <p className="mt-2 text-gray-400">
            {mode === "login" ? "Вход в аккаунт" : "Регистрация"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Ваше имя"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••"
              required
              minLength={6}
            />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-900/30 rounded-lg p-3">{error}</p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {mode === "login" ? "Зарегистрироваться" : "Войти"}
          </button>
        </p>
      </div>
    </main>
  );
}
