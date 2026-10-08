-- Seed do protótipo "Prova Oral com IA": 5 perguntas principais + 3
-- complementares pré-cadastradas sobre Convulsiones Febriles (Pediatría),
-- conforme o prompt de especificação (seção 11). Conteúdo clínico revisado
-- contra RCH Melbourne / AAP / NICE -- ver referências em cada pergunta.
--
-- status_revisao = 'aprovado' desde já: o protótipo inteiro está restrito a
-- admin na camada de aplicação (app/dashboard/mesa-oral/page.tsx), então
-- não há risco de um aluno ver conteúdo não revisado por estar "aprovado"
-- no banco -- é só o que destrava o fluxo de teste completo.

begin;

-- ============================================================
-- PREGUNTA 1 — Definición y clasificación
-- ============================================================
insert into public.oral_question_bank (id, disciplina, tema, nivel, ordem, pergunta, resposta_padrao, fontes, status_revisao)
values (
  '6c0e692f-a608-4a48-ac2c-e23fce4f186a',
  'Pediatría', 'Convulsiones febriles', 'pregrado', 1,
  $t$Un niño de 18 meses presenta fiebre de 39 °C y un episodio convulsivo tónico-clónico generalizado que dura cuatro minutos. Es el primer episodio, no tiene antecedentes de crisis afebriles, no presenta signos de infección del sistema nervioso central y recupera su estado neurológico habitual. ¿Qué es una convulsión febril y cómo se clasifican las convulsiones febriles simples y complejas?$t$,
  $t$Una convulsión febril es una crisis convulsiva asociada con fiebre, generalmente igual o superior a 38 °C, que ocurre habitualmente entre los 6 meses y los 5 años, sin evidencia de infección del sistema nervioso central, alteraciones metabólicas causales ni antecedentes de crisis afebriles.

Convulsión febril simple: crisis generalizada, duración inferior a 15 minutos, sin recurrencia en las siguientes 24 horas ni durante el mismo episodio febril, recuperación neurológica completa.

Convulsión febril compleja: presenta al menos una característica de complejidad -- focalidad, duración de 15 minutos o más, recurrencia durante el mismo episodio febril, o alteración neurológica persistente que requiere evaluación adicional.

El caso presentado es compatible con una convulsión febril simple, siempre que la evaluación clínica no identifique una causa alternativa.$t$,
  array['Royal Children''s Hospital Melbourne — Febrile seizure (2026-02)', 'AAP — Neurodiagnostic evaluation of simple febrile seizures'],
  'aprovado'
);

insert into public.oral_question_criteria (question_id, criterio_codigo, descricao, peso, ordem) values
  ('6c0e692f-a608-4a48-ac2c-e23fce4f186a', 'CF1-C1', 'Define correctamente la convulsión febril y su rango etario habitual.', 25, 1),
  ('6c0e692f-a608-4a48-ac2c-e23fce4f186a', 'CF1-C2', 'Identifica las características de una crisis febril simple.', 25, 2),
  ('6c0e692f-a608-4a48-ac2c-e23fce4f186a', 'CF1-C3', 'Identifica las características que clasifican una crisis como compleja.', 35, 3),
  ('6c0e692f-a608-4a48-ac2c-e23fce4f186a', 'CF1-C4', 'Reconoce que deben descartarse infección del SNC y otras causas de convulsión.', 15, 4);

insert into public.oral_question_followups (id, question_id, codigo, condicao, pergunta, resposta_esperada, criterios_alvo, ordem) values (
  'a0538843-8b05-4114-a73a-ddf5d76537a5',
  '6c0e692f-a608-4a48-ac2c-e23fce4f186a',
  'CF1-COMP1',
  'Usar cuando el alumno no haya demostrado suficientemente los criterios de clasificación o cuando sea necesario evaluar su aplicación clínica.',
  $t$Ahora imaginá que el mismo niño presenta dos convulsiones generalizadas de tres minutos cada una durante el mismo día, con recuperación entre ambas. ¿Cómo clasificarías este cuadro y qué cambiaría en tu evaluación clínica?$t$,
  $t$Se trata de una convulsión febril compleja por recurrencia. Aunque las crisis sean breves y generalizadas, la recurrencia constituye una característica de complejidad. Se necesita una valoración clínica más cuidadosa: evaluar estado neurológico, origen de la fiebre y signos de infección grave, considerar observación y valoración pediátrica según la evolución. La clasificación como compleja no implica solicitar automáticamente tomografía, electroencefalograma ni punción lumbar a todos los pacientes.$t$,
  array['CF1-C2', 'CF1-C3'],
  1
);

-- ============================================================
-- PREGUNTA 2 — Manejo de una convulsión febril activa
-- ============================================================
insert into public.oral_question_bank (id, disciplina, tema, nivel, ordem, pergunta, resposta_padrao, fontes, status_revisao)
values (
  'f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040',
  'Pediatría', 'Convulsiones febriles', 'pregrado', 2,
  $t$Una niña de dos años llega a la guardia con fiebre de 39,5 °C y movimientos tónico-clónicos generalizados. La madre refiere que la convulsión comenzó hace seis minutos y la paciente continúa convulsionando. Explicá paso a paso qué harías durante la atención inicial.$t$,
  $t$Evaluación y estabilización: solicitar ayuda y comenzar la evaluación ABCDE, proteger a la paciente de traumatismos, evitar introducir objetos en la boca, no sujetar violentamente sus movimientos, garantizar una vía aérea permeable, posicionar adecuadamente a la paciente cuando sea seguro, valorar respiración/oxigenación/circulación, monitorizar frecuencia cardíaca, saturación y signos vitales, determinar duración total de la convulsión, controlar glucemia capilar.

Tratamiento de la crisis: una crisis que continúa durante cinco minutos o más requiere tratamiento farmacológico urgente -- benzodiacepina de primera línea según protocolo pediátrico local. Si no hay acceso intravenoso inmediato, considerar midazolam intranasal o bucal (referencia guía RCH: 0,3 mg/kg, máximo 10 mg; verificar presentación, concentración y protocolo institucional). Contabilizar dosis de benzodiacepinas administradas antes de llegar al hospital. Vigilar respiración y efectos adversos. Si persiste, seguir el algoritmo institucional de crisis prolongada, evitando benzodiacepinas indefinidamente, y considerar tratamiento de segunda línea y apoyo especializado.

Después de estabilizar: evaluación neurológica, investigar origen de la fiebre, descartar infección del SNC y otras causas. No retrasar el tratamiento anticonvulsivante mientras se intenta reducir la temperatura.$t$,
  array['Royal Children''s Hospital Melbourne — Seizures: acute management'],
  'aprovado'
);

insert into public.oral_question_criteria (question_id, criterio_codigo, descricao, peso, ordem) values
  ('f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040', 'CF2-C1', 'Realiza evaluación ABCDE y estabilización inicial.', 20, 1),
  ('f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040', 'CF2-C2', 'Incluye medidas de protección y control del tiempo.', 15, 2),
  ('f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040', 'CF2-C3', 'Solicita glucemia y considera causas reversibles.', 15, 3),
  ('f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040', 'CF2-C4', 'Identifica la necesidad de benzodiacepinas después de cinco minutos y una vía apropiada.', 35, 4),
  ('f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040', 'CF2-C5', 'Reconoce las dosis previas, el límite de benzodiacepinas y la necesidad de escalamiento.', 15, 5);

insert into public.oral_question_followups (id, question_id, codigo, condicao, pergunta, resposta_esperada, criterios_alvo, ordem) values (
  'd0c2008e-0eb3-49d4-ae20-0f02307d7413',
  'f5e11fbb-8f6e-4a16-9c5b-4c3ff40fd040',
  'CF2-COMP1',
  'Preguntar cuando el alumno no haya explicado adecuadamente qué hacer ante una crisis que persiste después de recibir medicación.',
  $t$La paciente ya recibió una dosis adecuada de midazolam durante el traslado en ambulancia, pero continúa convulsionando al llegar a la guardia. ¿Cómo continuarías el tratamiento y qué precauciones tendrías para evitar complicaciones?$t$,
  $t$Reevaluar ABCDE, glucemia, oxigenación y monitorización. Verificar dosis, vía y horario del midazolam ya administrado y contabilizar la dosis prehospitalaria. Evitar exceder el número recomendado de benzodiacepinas (referencia: máximo de dos dosis apropiadas contando las administradas antes del ingreso). Considerar una segunda dosis según el algoritmo e intervalo recomendado, si corresponde. Si la crisis persiste tras el tratamiento inicial adecuado, avanzar al tratamiento de segunda línea y solicitar apoyo especializado. Vigilar depresión respiratoria y prepararse para soporte ventilatorio cuando sea necesario.$t$,
  array['CF2-C4', 'CF2-C5'],
  1
);

-- ============================================================
-- PREGUNTA 3 — Estudios complementarios y punción lumbar
-- ============================================================
insert into public.oral_question_bank (id, disciplina, tema, nivel, ordem, pergunta, resposta_padrao, fontes, status_revisao)
values (
  '7a5d47ed-47dc-489c-9a78-52c395af0985',
  'Pediatría', 'Convulsiones febriles', 'pregrado', 3,
  $t$Un niño de 15 meses consulta después de una convulsión febril simple de tres minutos. Actualmente está despierto, activo, con examen neurológico normal y calendario de vacunación completo. Presenta síntomas compatibles con una infección respiratoria viral. ¿Qué estudios complementarios solicitarías? ¿En qué situaciones considerarías realizar una punción lumbar?$t$,
  $t$En una convulsión febril simple, en un niño clínicamente estable y con recuperación neurológica completa: no se solicitan rutinariamente hemograma, electrolitos, neuroimágenes ni EEG solo por la convulsión; no se realiza punción lumbar de manera rutinaria. La evaluación debe orientarse a identificar el origen de la fiebre y descartar infección grave -- los estudios se solicitan según hallazgos clínicos, no de forma indiscriminada.

Punción lumbar: indicada cuando existe sospecha clínica de meningitis u otra infección del SNC y no hay contraindicaciones. Evaluar especialmente: signos meníngeos, alteración persistente del estado de conciencia, aspecto tóxico o signos de sepsis, signos neurológicos sugestivos de infección del SNC, lactantes de 6 a 12 meses con inmunización incompleta o desconocida contra Hib y neumococo (según contexto clínico), y uso previo de antibióticos que puedan enmascarar manifestaciones de meningitis.

La sospecha de infección del SNC exige evaluación urgente y la decisión no depende únicamente de la presencia de una convulsión febril.$t$,
  array['Royal Children''s Hospital Melbourne — Febrile seizure (2026-02)', 'NICE NG143 — Fever in under 5s'],
  'aprovado'
);

insert into public.oral_question_criteria (question_id, criterio_codigo, descricao, peso, ordem) values
  ('7a5d47ed-47dc-489c-9a78-52c395af0985', 'CF3-C1', 'Evalúa el estado clínico y busca el origen de la fiebre.', 20, 1),
  ('7a5d47ed-47dc-489c-9a78-52c395af0985', 'CF3-C2', 'Reconoce que no se solicitan estudios generales, EEG ni neuroimágenes rutinarias en una convulsión febril simple.', 30, 2),
  ('7a5d47ed-47dc-489c-9a78-52c395af0985', 'CF3-C3', 'Identifica correctamente las indicaciones y circunstancias para considerar punción lumbar.', 30, 3),
  ('7a5d47ed-47dc-489c-9a78-52c395af0985', 'CF3-C4', 'Diferencia la evaluación de una convulsión simple de una presentación atípica o compleja.', 20, 4);

insert into public.oral_question_followups (id, question_id, codigo, condicao, pergunta, resposta_esperada, criterios_alvo, ordem) values (
  '65a5aa9f-a2d5-4ec1-bf66-fb9cd265716b',
  '7a5d47ed-47dc-489c-9a78-52c395af0985',
  'CF3-COMP1',
  'Utilizar cuando sea necesario profundizar el razonamiento sobre indicación de punción lumbar.',
  $t$Ahora el paciente tiene ocho meses, presentó una convulsión asociada a fiebre, recibió antibióticos antes de la consulta y no podemos confirmar si tiene las vacunas contra Haemophilus influenzae tipo b y neumococo. ¿Cómo modificarías tu evaluación y qué factores considerarías para decidir una punción lumbar?$t$,
  $t$Mayor atención a la posibilidad de infección del SNC -- los lactantes pueden presentar signos meníngeos poco evidentes. La vacunación incompleta o desconocida modifica la evaluación del riesgo, y antibióticos previos pueden enmascarar manifestaciones de meningitis. Valorar estado general, nivel de conciencia, examen neurológico y signos de infección grave. Considerar punción lumbar según la evaluación clínica y recomendaciones aplicables, con participación pediátrica cuando corresponda -- no indicar ni descartar automáticamente la punción lumbar basándose exclusivamente en la edad. Si existe sospecha de meningitis bacteriana, proceder con evaluación y tratamiento urgentes conforme al protocolo institucional.$t$,
  array['CF3-C3'],
  1
);

-- ============================================================
-- PREGUNTA 4 — Criterios de alta e internación
-- ============================================================
insert into public.oral_question_bank (id, disciplina, tema, nivel, ordem, pergunta, resposta_padrao, fontes, status_revisao)
values (
  'a8897c95-e6fe-478f-87f4-55ae1b1c45af',
  'Pediatría', 'Convulsiones febriles', 'pregrado', 4,
  $t$Un niño de dos años presentó su primera convulsión febril simple, de cuatro minutos de duración. Después de un período de observación recuperó completamente su estado neurológico, tiene signos vitales estables y se identificó una infección viral leve. ¿Qué criterios considerarías para darle el alta y en qué circunstancias indicarías internación u observación prolongada?$t$,
  $t$Criterios favorables para el alta: convulsión febril simple y autolimitada, recuperación neurológica completa, signos vitales estables, ausencia de signos de infección grave, evaluación adecuada del origen de la fiebre, buen estado general y tolerancia oral cuando corresponda, familia capaz de reconocer signos de alarma, posibilidad de seguimiento y regreso a un centro médico.

Situaciones que requieren observación adicional, valoración pediátrica o internación según la gravedad: convulsión prolongada o recurrente, focalidad, alteración persistente del estado de conciencia, signos meníngeos, sospecha de sepsis/meningitis/encefalitis, compromiso respiratorio o hemodinámico, deshidratación importante, recuperación neurológica incompleta, dificultades significativas para seguimiento seguro.

No todas las convulsiones febriles complejas requieren necesariamente internación, pero sí una evaluación individualizada más cuidadosa.$t$,
  array['Royal Children''s Hospital Melbourne — Febrile seizure (2026-02)'],
  'aprovado'
);

insert into public.oral_question_criteria (question_id, criterio_codigo, descricao, peso, ordem) values
  ('a8897c95-e6fe-478f-87f4-55ae1b1c45af', 'CF4-C1', 'Identifica los criterios clínicos para un alta segura.', 30, 1),
  ('a8897c95-e6fe-478f-87f4-55ae1b1c45af', 'CF4-C2', 'Reconoce la necesidad de evaluar y manejar la causa de la fiebre.', 25, 2),
  ('a8897c95-e6fe-478f-87f4-55ae1b1c45af', 'CF4-C3', 'Identifica signos de alarma que requieren mayor evaluación u hospitalización.', 30, 3),
  ('a8897c95-e6fe-478f-87f4-55ae1b1c45af', 'CF4-C4', 'Incluye educación familiar y seguimiento apropiado.', 15, 4);

-- Sin complementar pre-cadastrada (a IA pode criar uma contextual se necessário).

-- ============================================================
-- PREGUNTA 5 — Educación familiar y prevención
-- ============================================================
insert into public.oral_question_bank (id, disciplina, tema, nivel, ordem, pergunta, resposta_padrao, fontes, status_revisao)
values (
  '32c6636b-6212-4963-80de-b06519ea0623',
  'Pediatría', 'Convulsiones febriles', 'pregrado', 5,
  $t$Una madre está muy preocupada porque su hijo de dos años tuvo una convulsión febril simple. Te pregunta si puede volver a suceder, si su hijo tendrá epilepsia y qué debe hacer si presenta otra convulsión en su casa. ¿Cómo orientarías a esta familia?$t$,
  $t$Pronóstico: la mayoría de las convulsiones febriles simples tiene un pronóstico favorable, pueden repetirse durante nuevas enfermedades febriles, una convulsión febril simple no significa que el niño tenga epilepsia, y el riesgo de epilepsia futura es bajo en niños sin otros factores de riesgo.

Primeros auxilios: mantener la calma, acostar al niño en un lugar seguro, protegerlo de golpes, colocarlo de lado cuando sea seguro y mantener la vía aérea libre, no sujetar los movimientos, no introducir objetos en la boca, no administrar alimentos ni líquidos durante la convulsión, controlar cuánto dura el episodio, solicitar asistencia urgente si la crisis dura cinco minutos o más, aparece compromiso respiratorio, existe recuperación anormal o aparecen otros signos de alarma.

Manejo de la fiebre: paracetamol o ibuprofeno pueden utilizarse para aliviar el malestar febril cuando estén indicados; los antitérmicos no previenen de forma fiable la aparición de nuevas convulsiones febriles; no se recomienda tratamiento anticonvulsivante preventivo continuo de rutina después de una convulsión febril simple.

Seguimiento: orientar sobre signos de alarma, recomendar evaluación médica cuando corresponda, mantener controles de salud y vacunación, considerar un plan individualizado de medicación de rescate únicamente cuando esté indicado y prescrito.$t$,
  array['American Academy of Pediatrics — Neurodiagnostic evaluation of simple febrile seizures'],
  'aprovado'
);

insert into public.oral_question_criteria (question_id, criterio_codigo, descricao, peso, ordem) values
  ('32c6636b-6212-4963-80de-b06519ea0623', 'CF5-C1', 'Explica correctamente primeros auxilios durante una convulsión.', 35, 1),
  ('32c6636b-6212-4963-80de-b06519ea0623', 'CF5-C2', 'Reconoce cuándo solicitar asistencia urgente.', 25, 2),
  ('32c6636b-6212-4963-80de-b06519ea0623', 'CF5-C3', 'Explica el uso correcto de antitérmicos y que no previenen de forma fiable las convulsiones.', 20, 3),
  ('32c6636b-6212-4963-80de-b06519ea0623', 'CF5-C4', 'Explica el pronóstico y que no se recomienda profilaxis anticonvulsivante rutinaria.', 20, 4);

-- Sin complementar pre-cadastrada (a IA pode criar uma contextual se necessário).

commit;
