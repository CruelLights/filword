import Link from "next/link";
import { FloatingEmojis } from "@/components/floating-emojis";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 relative">
      <FloatingEmojis />
      <div className="max-w-md w-full text-center space-y-8 relative z-10">
        <div>
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Фил<span className="text-blue-500">ворд</span>
          </h1>
          <p className="mt-3 text-gray-400 text-lg">
            Найди слова быстрее соперников
          </p>
        </div>

        <div className="card text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔤</span>
            <div>
              <p className="font-medium text-white">Поле 10×10</p>
              <p className="text-sm text-gray-400">Слова спрятаны в таблице букв</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="font-medium text-white">Реальное время</p>
              <p className="text-sm text-gray-400">2–6 игроков, live-синхронизация</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-medium text-white">Соревнование</p>
              <p className="text-sm text-gray-400">Побеждает тот, кто найдёт больше слов</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Link href="/lobby" className="btn-primary w-full text-lg py-3 block">
            Играть
          </Link>
          <Link href="/stats" className="btn-secondary w-full block">
            🏆 Лидерборд
          </Link>
          <Link href="/login" className="btn-secondary w-full block">
            Войти / Зарегистрироваться
          </Link>
        </div>
      </div>
    </main>
  );
}