import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos de Servicio — MedClass UNR",
  description: "Términos y condiciones de uso de la plataforma MedClass UNR.",
}

const ACTUALIZADO = "13 de noviembre de 2026"
const CONTACTO = "medclassunr@gmail.com"

export default function TerminosServicio() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-foreground">
      <h1 className="text-3xl font-bold">Términos de Servicio</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {ACTUALIZADO}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <p>
            Estos Términos de Servicio (&quot;Términos&quot;) regulan el uso de la plataforma{" "}
            <strong>MedClass UNR</strong>, disponible en <strong>medclass.com.ar</strong>. Al crear una
            cuenta o usar la Plataforma, aceptás estos Términos. Si no estás de acuerdo, no uses la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">1. Descripción del servicio</h2>
          <p className="mt-2">
            MedClass UNR es una plataforma educativa destinada a estudiantes de medicina (orientada al plan de
            estudios de la UNR), que ofrece simulacros, material de estudio, resúmenes, seguimiento de progreso
            y herramientas relacionadas. El contenido tiene fines educativos y no constituye asesoramiento
            médico profesional.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Cuentas de usuario</h2>
          <p className="mt-2">
            Sos responsable de mantener la confidencialidad de tus credenciales y de toda la actividad que
            ocurra en tu cuenta. Debés proporcionar información veraz y actualizada. Podemos suspender o
            cancelar cuentas que incumplan estos Términos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Uso aceptable</h2>
          <p className="mt-2">
            Te comprometés a no utilizar la Plataforma para fines ilícitos, a no intentar vulnerar su
            seguridad, a no distribuir contenido que no te pertenezca sin autorización y a no reproducir ni
            revender el contenido sin permiso.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Integración con Google Drive</h2>
          <p className="mt-2">
            Los administradores pueden conectar una cuenta de Google Drive para seleccionar y publicar
            materiales de estudio. El administrador es responsable de tener los derechos necesarios sobre los
            archivos que selecciona y comparte a través de la Plataforma. El uso de datos de Google se rige
            por nuestra{" "}
            <a className="text-primary underline" href="/privacidad">Política de Privacidad</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Propiedad intelectual</h2>
          <p className="mt-2">
            El software, la marca y los contenidos propios de la Plataforma están protegidos por las leyes
            aplicables. No se concede ningún derecho sobre ellos salvo el uso personal y no comercial que
            permiten estos Términos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Pagos y suscripciones</h2>
          <p className="mt-2">
            Algunas funciones pueden requerir un plan pago. Los precios, las condiciones y los medios de pago
            se informan en la Plataforma al momento de la contratación.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Limitación de responsabilidad</h2>
          <p className="mt-2">
            La Plataforma se ofrece &quot;tal cual&quot;. En la medida permitida por la ley, no garantizamos
            que el servicio sea ininterrumpido o libre de errores, ni somos responsables por daños indirectos
            derivados del uso o la imposibilidad de uso de la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Cambios en los Términos</h2>
          <p className="mt-2">
            Podemos modificar estos Términos. La versión vigente se publicará en esta página con su fecha de
            actualización. El uso continuado de la Plataforma implica la aceptación de los cambios.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">9. Contacto</h2>
          <p className="mt-2">
            Ante cualquier consulta sobre estos Términos, escribinos a <strong>{CONTACTO}</strong>.
          </p>
        </section>
      </div>
    </main>
  )
}
