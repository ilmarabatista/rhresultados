-- Reunião online: link da videochamada, resumo da IA e a transcrição em trechos.
ALTER TABLE "Meeting" ADD COLUMN "meetLink" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "summary" TEXT;

CREATE TABLE "MeetingTranscriptPart" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingTranscriptPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MeetingTranscriptPart_meetingId_recordedAt_idx" ON "MeetingTranscriptPart"("meetingId", "recordedAt");

ALTER TABLE "MeetingTranscriptPart" ADD CONSTRAINT "MeetingTranscriptPart_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Como as outras tabelas: RLS ligado, sem política (o sistema acessa pelo servidor).
ALTER TABLE "MeetingTranscriptPart" ENABLE ROW LEVEL SECURITY;
