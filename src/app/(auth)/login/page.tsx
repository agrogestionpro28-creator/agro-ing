import { login, signup } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const p = await searchParams;
  const isSignup = p.mode === 'signup';

  return (
    <main className="min-h-screen honeycomb-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-base-3 border-2 border-ochre rounded-xl mb-4">
            <span className="text-ochre font-black text-xl">AI</span>
          </div>
          <h1 className="text-2xl font-bold text-hi">Agro Ing</h1>
          <p className="text-mid text-sm mt-1">Panel del ingeniero agrónomo</p>
        </div>

        <form className="card p-6 space-y-4">
          {isSignup && (
            <div>
              <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Nombre completo</label>
              <input name="nombre" type="text" required className="field" placeholder="Juan Pérez" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Email</label>
            <input name="email" type="email" required className="field" placeholder="ing@ejemplo.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-mid mb-1.5 uppercase tracking-wider">Contraseña</label>
            <input name="password" type="password" required minLength={6} className="field" />
          </div>

          {p.error && (
            <p className="text-xs text-danger bg-red-900/20 border border-red-900/40 rounded px-3 py-2">
              {decodeURIComponent(p.error)}
            </p>
          )}

          <button formAction={isSignup ? signup : login} className="btn-primary w-full">
            {isSignup ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-sm text-lo mt-5">
          {isSignup ? (
            <>¿Ya tenés cuenta?{' '}
              <a href="/login" className="text-ochre hover:underline">Ingresar</a>
            </>
          ) : (
            <>¿Primera vez?{' '}
              <a href="/login?mode=signup" className="text-ochre hover:underline">Crear cuenta</a>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
