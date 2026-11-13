import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Privacidad — MedClass UNR",
  description: "Cómo MedClass UNR recopila, usa y protege tus datos, incluida la integración con Google Drive.",
}

const ACTUALIZADO = "13 de noviembre de 2026"
const CONTACTO = "medclassunr@gmail.com"

export default function PoliticaPrivacidad() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-foreground">
      <h1 className="text-3xl font-bold">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {ACTUALIZADO}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <p>
            Esta Política de Privacidad describe cómo <strong>MedClass UNR</strong> (&quot;nosotros&quot;,
            la &quot;Plataforma&quot;), disponible en <strong>medclass.com.ar</strong>, recopila, usa y
            protege la información de sus usuarios (&quot;vos&quot;, &quot;usuario&quot;). Al usar la
            Plataforma, aceptás las prácticas descritas en este documento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">1. Datos que recopilamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Datos de cuenta:</strong> nombre, dirección de correo electrónico y credenciales de acceso.</li>
            <li><strong>Datos de uso:</strong> actividad dentro de la Plataforma (simulacros, progreso, materiales consultados) para brindar y mejorar el servicio.</li>
            <li>
              <strong>Datos de Google (solo administradores):</strong> cuando un administrador conecta su
              cuenta de Google Drive, accedemos de forma limitada a Google Drive mediante Google OAuth.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Uso de datos de Google Drive</h2>
          <p className="mt-2">
            La integración con Google Drive utiliza el permiso <strong>drive.file</strong>. Esto significa
            que la Plataforma <strong>solo</strong> puede acceder a: (a) los archivos y carpetas que la
            propia Plataforma crea, y (b) los archivos que el administrador <strong>selecciona
            explícitamente</strong> a través del selector de archivos de Google (Google Picker). La
            Plataforma <strong>no</strong> tiene acceso general ni puede leer el resto de los archivos del
            Drive del administrador.
          </p>
          <p className="mt-2">
            Usamos ese acceso únicamente para: organizar y poner a disposición de los estudiantes los
            resúmenes y materiales de estudio seleccionados por el administrador; generar una imagen de
            portada de la tarjeta a partir del archivo elegido; y entregar esos archivos a los estudiantes
            autenticados a través de la propia Plataforma. No modificamos ni eliminamos archivos ajenos a
            los creados por la Plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Uso limitado (Google API Services)</h2>
          <p className="mt-2">
            El uso que hace MedClass UNR de la información recibida de las APIs de Google se ajusta a la{" "}
            <a
              className="text-primary underline"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de Datos de Usuario de los Servicios de API de Google
            </a>
            , incluidos los requisitos de Uso Limitado. No transferimos ni vendemos datos de Google a
            terceros, no los usamos con fines publicitarios y no permitimos que personas lean esos datos,
            salvo con tu consentimiento, para fines de seguridad o para cumplir la ley.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Almacenamiento y seguridad</h2>
          <p className="mt-2">
            Los datos de cuenta y de uso se almacenan en nuestra infraestructura (Supabase). Las credenciales
            de acceso a Google (token de actualización) se guardan de forma cifrada y solo se usan del lado
            del servidor; nunca se exponen en el navegador de los estudiantes. Aplicamos medidas técnicas y
            organizativas razonables para proteger la información.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Compartir información</h2>
          <p className="mt-2">
            No vendemos tus datos. Podemos compartir información con proveedores que nos ayudan a operar la
            Plataforma (por ejemplo, alojamiento y procesamiento de pagos), sujetos a obligaciones de
            confidencialidad, o cuando la ley lo exija.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Tus derechos</h2>
          <p className="mt-2">
            Podés solicitar el acceso, la corrección o la eliminación de tus datos personales, así como
            desconectar la integración con Google Drive en cualquier momento desde el panel de administración.
            Para ejercer estos derechos, escribinos a {CONTACTO}.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">7. Cambios en esta política</h2>
          <p className="mt-2">
            Podemos actualizar esta Política de Privacidad. Publicaremos la versión vigente en esta página con
            su fecha de actualización.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">8. Contacto</h2>
          <p className="mt-2">
            Ante cualquier consulta sobre esta política, escribinos a <strong>{CONTACTO}</strong>.
          </p>
        </section>
      </div>
    </main>
  )
}
