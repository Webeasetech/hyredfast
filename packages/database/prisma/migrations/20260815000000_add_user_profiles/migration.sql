-- CreateTable: answers to the signup questionnaire, one row per user.
-- Text arrays default to empty rather than NULL so "skipped" and "answered
-- nothing" read the same way in a query, and every scalar is nullable because
-- every question is skippable.
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "target_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" TEXT,
    "employment_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT,
    "city" TEXT,
    "work_modes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "will_relocate" BOOLEAN,
    "needs_sponsorship" BOOLEAN,
    "urgency" TEXT,
    "blockers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resume_parsed" JSONB,
    "resume_file_name" TEXT,
    "resume_parsed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_key" ON "user_profiles"("user");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
