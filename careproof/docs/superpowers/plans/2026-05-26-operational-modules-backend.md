# Operational Modules Backend Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real NestJS/MongoDB backend persistence for 6 new operational modules (Nurse Approvals, Inspection Findings, Social Work Cases, Intake Records, Medical Availability, Expiration Records), connect frontend screens to those APIs with fallback to demo data, and add tests — without breaking existing passing checks.

**Architecture:** Each module follows the exact pattern of `apps/backend/src/incidents/`: schema → DTOs → service → controller → module registration. All queries are scoped by `agencyId` with `deletedAt: null` soft delete. All writes call `AuditService.log()`. Frontend screens call the real API in a `useEffect` with `callProtectedApi`, falling back to the demo data array on failure.

**Tech Stack:** NestJS 10, Mongoose 8, class-validator, Next.js 14 App Router, TypeScript 5.

---

## File Map

### Backend — new files
- `apps/backend/src/nurse-approvals/nurse-approval.schema.ts`
- `apps/backend/src/nurse-approvals/dto/create-nurse-approval.dto.ts`
- `apps/backend/src/nurse-approvals/dto/decide-nurse-approval.dto.ts`
- `apps/backend/src/nurse-approvals/nurse-approvals.service.ts`
- `apps/backend/src/nurse-approvals/nurse-approvals.controller.ts`
- `apps/backend/src/nurse-approvals/nurse-approvals.module.ts`
- `apps/backend/src/inspection-findings/inspection-rule.schema.ts`
- `apps/backend/src/inspection-findings/inspection-finding.schema.ts`
- `apps/backend/src/inspection-findings/dto/update-finding-status.dto.ts`
- `apps/backend/src/inspection-findings/inspection-findings.service.ts`
- `apps/backend/src/inspection-findings/inspection-findings.controller.ts`
- `apps/backend/src/inspection-findings/inspection-findings.module.ts`
- `apps/backend/src/social-work-cases/social-work-case.schema.ts`
- `apps/backend/src/social-work-cases/dto/create-social-work-case.dto.ts`
- `apps/backend/src/social-work-cases/dto/update-case-status.dto.ts`
- `apps/backend/src/social-work-cases/social-work-cases.service.ts`
- `apps/backend/src/social-work-cases/social-work-cases.controller.ts`
- `apps/backend/src/social-work-cases/social-work-cases.module.ts`
- `apps/backend/src/intake-records/intake-record.schema.ts`
- `apps/backend/src/intake-records/dto/create-intake-record.dto.ts`
- `apps/backend/src/intake-records/dto/update-intake-stage.dto.ts`
- `apps/backend/src/intake-records/intake-records.service.ts`
- `apps/backend/src/intake-records/intake-records.controller.ts`
- `apps/backend/src/intake-records/intake-records.module.ts`
- `apps/backend/src/medical-availability/medical-availability.schema.ts`
- `apps/backend/src/medical-availability/dto/update-availability-status.dto.ts`
- `apps/backend/src/medical-availability/medical-availability.service.ts`
- `apps/backend/src/medical-availability/medical-availability.controller.ts`
- `apps/backend/src/medical-availability/medical-availability.module.ts`
- `apps/backend/src/expiration-records/expiration-record.schema.ts`
- `apps/backend/src/expiration-records/dto/update-renewal-status.dto.ts`
- `apps/backend/src/expiration-records/expiration-records.service.ts`
- `apps/backend/src/expiration-records/expiration-records.controller.ts`
- `apps/backend/src/expiration-records/expiration-records.module.ts`
- `apps/backend/test/operational-modules.spec.ts`

### Backend — modified files
- `apps/backend/src/auth/permissions.ts` — add 12 new permission actions
- `apps/backend/src/notifications/notifications.templates.ts` — add 5 new templates
- `apps/backend/src/seed/demo-data.ts` — seed 6 new collections
- `apps/backend/src/app.module.ts` — register 6 new modules

### Frontend — modified files
- `apps/web/src/lib/api-client.ts` — add 6 API helper functions
- `apps/web/src/components/careproof-ui.tsx` — update 7 screens with real API + loading/error/empty states

---

### Task 1: Extend permissions and notification templates

**Files:**
- Modify: `apps/backend/src/auth/permissions.ts`
- Modify: `apps/backend/src/notifications/notifications.templates.ts`

- [ ] **Step 1: Read current permissions.ts**

```bash
cat apps/backend/src/auth/permissions.ts
```

- [ ] **Step 2: Add 12 new permission actions**

In `apps/backend/src/auth/permissions.ts`, extend `PermissionAction` union type to include:

```typescript
  | 'nurse_approval.read'
  | 'nurse_approval.write'
  | 'inspection.read'
  | 'inspection.write'
  | 'social_work.read'
  | 'social_work.write'
  | 'intake.read'
  | 'intake.write'
  | 'medical_availability.read'
  | 'medical_availability.write'
  | 'expiration.read'
  | 'expiration.write'
```

And in `ROLE_PERMISSIONS`, grant:
- `AGENCY_OWNER`, `AGENCY_ADMIN`, `CARE_COORDINATOR`: all 12 new actions
- `CAREGIVER`: `nurse_approval.read`, `inspection.read`, `medical_availability.read`, `expiration.read`
- `FAMILY_MEMBER`, `CLIENT`: none of the new actions

- [ ] **Step 3: Add 5 new notification templates**

In `apps/backend/src/notifications/notifications.templates.ts`, add:

```typescript
nurse_approval_needed: {
  title: 'Nurse Approval Required',
  body: (data: Record<string, string>) =>
    `Visit for ${data.clientName} on ${data.date} requires nurse approval.`,
},
inspection_finding_opened: {
  title: 'New Inspection Finding',
  body: (data: Record<string, string>) =>
    `Inspection finding "${data.title}" opened with severity ${data.severity}.`,
},
expiring_document: {
  title: 'Document Expiring Soon',
  body: (data: Record<string, string>) =>
    `${data.documentType} for ${data.caregiverName} expires on ${data.expiryDate}.`,
},
medical_availability_missing: {
  title: 'Medical Availability Not Confirmed',
  body: (data: Record<string, string>) =>
    `Medical availability for client ${data.clientName} has not been confirmed.`,
},
social_work_follow_up_due: {
  title: 'Social Work Follow-Up Due',
  body: (data: Record<string, string>) =>
    `Social work case for ${data.clientName} has a follow-up due on ${data.dueDate}.`,
},
```

- [ ] **Step 4: Run typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors in permissions.ts or notifications.templates.ts

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/auth/permissions.ts apps/backend/src/notifications/notifications.templates.ts
git commit -m "feat: add permissions and notification templates for operational modules"
```

---

### Task 2: Nurse Approvals — backend module

**Files:**
- Create: `apps/backend/src/nurse-approvals/nurse-approval.schema.ts`
- Create: `apps/backend/src/nurse-approvals/dto/create-nurse-approval.dto.ts`
- Create: `apps/backend/src/nurse-approvals/dto/decide-nurse-approval.dto.ts`
- Create: `apps/backend/src/nurse-approvals/nurse-approvals.service.ts`
- Create: `apps/backend/src/nurse-approvals/nurse-approvals.controller.ts`
- Create: `apps/backend/src/nurse-approvals/nurse-approvals.module.ts`

- [ ] **Step 1: Create schema**

`apps/backend/src/nurse-approvals/nurse-approval.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NurseApprovalDocument = NurseApproval & Document;

@Schema({ timestamps: true, collection: 'nurseApprovals' })
export class NurseApproval {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  visitId: Types.ObjectId;

  @Prop({ required: true })
  clientName: string;

  @Prop({ required: true })
  caregiverName: string;

  @Prop({ required: true })
  visitDate: string;

  @Prop({ required: true })
  visitType: string;

  @Prop({
    required: true,
    enum: ['pending_review', 'approved', 'rejected', 'needs_clarification'],
    default: 'pending_review',
  })
  status: string;

  @Prop()
  nurseNotes: string;

  @Prop({ type: Types.ObjectId })
  reviewedBy: Types.ObjectId;

  @Prop()
  reviewedAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const NurseApprovalSchema = SchemaFactory.createForClass(NurseApproval);
NurseApprovalSchema.index({ agencyId: 1, status: 1 });
NurseApprovalSchema.index({ agencyId: 1, createdAt: -1 });
```

- [ ] **Step 2: Create DTOs**

`apps/backend/src/nurse-approvals/dto/create-nurse-approval.dto.ts`:

```typescript
import { IsString, IsMongoId, IsOptional } from 'class-validator';

export class CreateNurseApprovalDto {
  @IsMongoId()
  visitId: string;

  @IsString()
  clientName: string;

  @IsString()
  caregiverName: string;

  @IsString()
  visitDate: string;

  @IsString()
  visitType: string;

  @IsString()
  @IsOptional()
  nurseNotes?: string;
}
```

`apps/backend/src/nurse-approvals/dto/decide-nurse-approval.dto.ts`:

```typescript
import { IsIn, IsString, IsOptional } from 'class-validator';

export class DecideNurseApprovalDto {
  @IsIn(['approved', 'rejected', 'needs_clarification'])
  decision: 'approved' | 'rejected' | 'needs_clarification';

  @IsString()
  @IsOptional()
  nurseNotes?: string;
}
```

- [ ] **Step 3: Create service**

`apps/backend/src/nurse-approvals/nurse-approvals.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NurseApproval, NurseApprovalDocument } from './nurse-approval.schema';
import { CreateNurseApprovalDto } from './dto/create-nurse-approval.dto';
import { DecideNurseApprovalDto } from './dto/decide-nurse-approval.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class NurseApprovalsService {
  constructor(
    @InjectModel(NurseApproval.name)
    private readonly model: Model<NurseApprovalDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'nurse_approval.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(actor: AuthUser, dto: CreateNurseApprovalDto) {
    requirePermission(actor.role, 'nurse_approval.write');
    const doc = await this.model.create({
      ...dto,
      visitId: new Types.ObjectId(dto.visitId),
      agencyId: new Types.ObjectId(actor.agencyId),
      status: 'pending_review',
    });
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: 'nurse_approval.created',
      resourceType: 'NurseApproval',
      resourceId: doc._id.toString(),
    });
    return doc;
  }

  async findOne(actor: AuthUser, id: string) {
    requirePermission(actor.role, 'nurse_approval.read');
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .lean();
    if (!doc) throw new NotFoundException('Nurse approval not found');
    return doc;
  }

  async decide(actor: AuthUser, id: string, dto: DecideNurseApprovalDto) {
    requirePermission(actor.role, 'nurse_approval.write');
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      {
        status: dto.decision,
        nurseNotes: dto.nurseNotes,
        reviewedBy: new Types.ObjectId(actor.sub),
        reviewedAt: new Date(),
      },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Nurse approval not found');
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: `nurse_approval.${dto.decision}`,
      resourceType: 'NurseApproval',
      resourceId: id,
    });
    return doc;
  }
}
```

- [ ] **Step 4: Create controller**

`apps/backend/src/nurse-approvals/nurse-approvals.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { NurseApprovalsService } from './nurse-approvals.service';
import { CreateNurseApprovalDto } from './dto/create-nurse-approval.dto';
import { DecideNurseApprovalDto } from './dto/decide-nurse-approval.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nurse-approvals')
export class NurseApprovalsController {
  constructor(private readonly service: NurseApprovalsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateNurseApprovalDto) {
    return this.service.create(actor, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.service.findOne(actor, id);
  }

  @Patch(':id/decide')
  decide(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: DecideNurseApprovalDto) {
    return this.service.decide(actor, id, dto);
  }
}
```

- [ ] **Step 5: Create module**

`apps/backend/src/nurse-approvals/nurse-approvals.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NurseApproval, NurseApprovalSchema } from './nurse-approval.schema';
import { NurseApprovalsService } from './nurse-approvals.service';
import { NurseApprovalsController } from './nurse-approvals.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NurseApproval.name, schema: NurseApprovalSchema }]),
    AuditModule,
  ],
  controllers: [NurseApprovalsController],
  providers: [NurseApprovalsService],
  exports: [NurseApprovalsService],
})
export class NurseApprovalsModule {}
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors in nurse-approvals/

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/nurse-approvals/
git commit -m "feat: add NurseApprovals backend module"
```

---

### Task 3: Inspection Findings — backend module

**Files:**
- Create: `apps/backend/src/inspection-findings/inspection-rule.schema.ts`
- Create: `apps/backend/src/inspection-findings/inspection-finding.schema.ts`
- Create: `apps/backend/src/inspection-findings/dto/update-finding-status.dto.ts`
- Create: `apps/backend/src/inspection-findings/inspection-findings.service.ts`
- Create: `apps/backend/src/inspection-findings/inspection-findings.controller.ts`
- Create: `apps/backend/src/inspection-findings/inspection-findings.module.ts`

- [ ] **Step 1: Create schemas**

`apps/backend/src/inspection-findings/inspection-rule.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InspectionRuleDocument = InspectionRule & Document;

@Schema({ timestamps: true, collection: 'inspectionRules' })
export class InspectionRule {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ required: true })
  ruleCode: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: ['critical', 'high', 'medium', 'low'] })
  severity: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const InspectionRuleSchema = SchemaFactory.createForClass(InspectionRule);
```

`apps/backend/src/inspection-findings/inspection-finding.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InspectionFindingDocument = InspectionFinding & Document;

@Schema({ timestamps: true, collection: 'inspectionFindings' })
export class InspectionFinding {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  ruleId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: ['critical', 'high', 'medium', 'low'] })
  severity: string;

  @Prop({ required: true, enum: ['open', 'in_progress', 'resolved', 'waived'] })
  status: string;

  @Prop()
  description: string;

  @Prop()
  assignedTo: string;

  @Prop()
  dueDate: string;

  @Prop()
  resolvedAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const InspectionFindingSchema = SchemaFactory.createForClass(InspectionFinding);
InspectionFindingSchema.index({ agencyId: 1, status: 1 });
```

- [ ] **Step 2: Create DTO**

`apps/backend/src/inspection-findings/dto/update-finding-status.dto.ts`:

```typescript
import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateFindingStatusDto {
  @IsIn(['open', 'in_progress', 'resolved', 'waived'])
  status: 'open' | 'in_progress' | 'resolved' | 'waived';

  @IsString()
  @IsOptional()
  notes?: string;
}
```

- [ ] **Step 3: Create service**

`apps/backend/src/inspection-findings/inspection-findings.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InspectionRule, InspectionRuleDocument } from './inspection-rule.schema';
import { InspectionFinding, InspectionFindingDocument } from './inspection-finding.schema';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class InspectionFindingsService {
  constructor(
    @InjectModel(InspectionRule.name)
    private readonly rulesModel: Model<InspectionRuleDocument>,
    @InjectModel(InspectionFinding.name)
    private readonly findingsModel: Model<InspectionFindingDocument>,
    private readonly auditService: AuditService,
  ) {}

  async listRules(actor: AuthUser) {
    requirePermission(actor.role, 'inspection.read');
    return this.rulesModel
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null, active: true })
      .sort({ severity: 1 })
      .lean();
  }

  async listFindings(actor: AuthUser) {
    requirePermission(actor.role, 'inspection.read');
    return this.findingsModel
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateFindingStatus(actor: AuthUser, id: string, dto: UpdateFindingStatusDto) {
    requirePermission(actor.role, 'inspection.write');
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'resolved') update.resolvedAt = new Date();
    const doc = await this.findingsModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Inspection finding not found');
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: `inspection_finding.${dto.status}`,
      resourceType: 'InspectionFinding',
      resourceId: id,
    });
    return doc;
  }
}
```

- [ ] **Step 4: Create controller**

`apps/backend/src/inspection-findings/inspection-findings.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { InspectionFindingsService } from './inspection-findings.service';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspection-findings')
export class InspectionFindingsController {
  constructor(private readonly service: InspectionFindingsService) {}

  @Get('rules')
  listRules(@CurrentUser() actor: AuthUser) {
    return this.service.listRules(actor);
  }

  @Get()
  listFindings(@CurrentUser() actor: AuthUser) {
    return this.service.listFindings(actor);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateFindingStatusDto) {
    return this.service.updateFindingStatus(actor, id, dto);
  }
}
```

- [ ] **Step 5: Create module**

`apps/backend/src/inspection-findings/inspection-findings.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InspectionRule, InspectionRuleSchema } from './inspection-rule.schema';
import { InspectionFinding, InspectionFindingSchema } from './inspection-finding.schema';
import { InspectionFindingsService } from './inspection-findings.service';
import { InspectionFindingsController } from './inspection-findings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InspectionRule.name, schema: InspectionRuleSchema },
      { name: InspectionFinding.name, schema: InspectionFindingSchema },
    ]),
    AuditModule,
  ],
  controllers: [InspectionFindingsController],
  providers: [InspectionFindingsService],
  exports: [InspectionFindingsService],
})
export class InspectionFindingsModule {}
```

- [ ] **Step 6: Typecheck and commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
git add apps/backend/src/inspection-findings/
git commit -m "feat: add InspectionFindings backend module"
```

---

### Task 4: Social Work Cases — backend module

**Files:**
- Create: `apps/backend/src/social-work-cases/social-work-case.schema.ts`
- Create: `apps/backend/src/social-work-cases/dto/create-social-work-case.dto.ts`
- Create: `apps/backend/src/social-work-cases/dto/update-case-status.dto.ts`
- Create: `apps/backend/src/social-work-cases/social-work-cases.service.ts`
- Create: `apps/backend/src/social-work-cases/social-work-cases.controller.ts`
- Create: `apps/backend/src/social-work-cases/social-work-cases.module.ts`

- [ ] **Step 1: Create schema**

`apps/backend/src/social-work-cases/social-work-case.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SocialWorkCaseDocument = SocialWorkCase & Document;

@Schema({ timestamps: true, collection: 'socialWorkCases' })
export class SocialWorkCase {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ required: true })
  clientName: string;

  @Prop({ type: Types.ObjectId })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  assignedWorker: string;

  @Prop({ required: true, enum: ['housing', 'benefits', 'mental_health', 'family', 'legal', 'other'] })
  category: string;

  @Prop({ required: true, enum: ['active', 'pending_review', 'closed', 'escalated'] })
  status: string;

  @Prop()
  description: string;

  @Prop()
  nextFollowUp: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'urgent'] })
  priority: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const SocialWorkCaseSchema = SchemaFactory.createForClass(SocialWorkCase);
SocialWorkCaseSchema.index({ agencyId: 1, status: 1 });
```

- [ ] **Step 2: Create DTOs**

`apps/backend/src/social-work-cases/dto/create-social-work-case.dto.ts`:

```typescript
import { IsString, IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateSocialWorkCaseDto {
  @IsString()
  clientName: string;

  @IsMongoId()
  @IsOptional()
  clientId?: string;

  @IsString()
  assignedWorker: string;

  @IsIn(['housing', 'benefits', 'mental_health', 'family', 'legal', 'other'])
  category: string;

  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  nextFollowUp?: string;
}
```

`apps/backend/src/social-work-cases/dto/update-case-status.dto.ts`:

```typescript
import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateCaseStatusDto {
  @IsIn(['active', 'pending_review', 'closed', 'escalated'])
  status: 'active' | 'pending_review' | 'closed' | 'escalated';

  @IsString()
  @IsOptional()
  notes?: string;
}
```

- [ ] **Step 3: Create service**

`apps/backend/src/social-work-cases/social-work-cases.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SocialWorkCase, SocialWorkCaseDocument } from './social-work-case.schema';
import { CreateSocialWorkCaseDto } from './dto/create-social-work-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class SocialWorkCasesService {
  constructor(
    @InjectModel(SocialWorkCase.name)
    private readonly model: Model<SocialWorkCaseDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'social_work.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(actor: AuthUser, dto: CreateSocialWorkCaseDto) {
    requirePermission(actor.role, 'social_work.write');
    const doc = await this.model.create({
      ...dto,
      clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : undefined,
      agencyId: new Types.ObjectId(actor.agencyId),
      status: 'active',
    });
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: 'social_work_case.created',
      resourceType: 'SocialWorkCase',
      resourceId: doc._id.toString(),
    });
    return doc;
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateCaseStatusDto) {
    requirePermission(actor.role, 'social_work.write');
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      { status: dto.status },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Social work case not found');
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: `social_work_case.${dto.status}`,
      resourceType: 'SocialWorkCase',
      resourceId: id,
    });
    return doc;
  }
}
```

- [ ] **Step 4: Create controller**

`apps/backend/src/social-work-cases/social-work-cases.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { SocialWorkCasesService } from './social-work-cases.service';
import { CreateSocialWorkCaseDto } from './dto/create-social-work-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('social-work-cases')
export class SocialWorkCasesController {
  constructor(private readonly service: SocialWorkCasesService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateSocialWorkCaseDto) {
    return this.service.create(actor, dto);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateCaseStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }
}
```

- [ ] **Step 5: Create module**

`apps/backend/src/social-work-cases/social-work-cases.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocialWorkCase, SocialWorkCaseSchema } from './social-work-case.schema';
import { SocialWorkCasesService } from './social-work-cases.service';
import { SocialWorkCasesController } from './social-work-cases.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SocialWorkCase.name, schema: SocialWorkCaseSchema }]),
    AuditModule,
  ],
  controllers: [SocialWorkCasesController],
  providers: [SocialWorkCasesService],
  exports: [SocialWorkCasesService],
})
export class SocialWorkCasesModule {}
```

- [ ] **Step 6: Typecheck and commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
git add apps/backend/src/social-work-cases/
git commit -m "feat: add SocialWorkCases backend module"
```

---

### Task 5: Intake Records — backend module

**Files:**
- Create: `apps/backend/src/intake-records/intake-record.schema.ts`
- Create: `apps/backend/src/intake-records/dto/create-intake-record.dto.ts`
- Create: `apps/backend/src/intake-records/dto/update-intake-stage.dto.ts`
- Create: `apps/backend/src/intake-records/intake-records.service.ts`
- Create: `apps/backend/src/intake-records/intake-records.controller.ts`
- Create: `apps/backend/src/intake-records/intake-records.module.ts`

- [ ] **Step 1: Create schema**

`apps/backend/src/intake-records/intake-record.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntakeRecordDocument = IntakeRecord & Document;

@Schema({ timestamps: true, collection: 'intakeRecords' })
export class IntakeRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ required: true })
  clientName: string;

  @Prop({ required: true })
  agentName: string;

  @Prop({ required: true, enum: ['inquiry', 'assessment', 'authorization', 'onboarding', 'active'] })
  stage: string;

  @Prop({ required: true })
  referralSource: string;

  @Prop()
  primaryDiagnosis: string;

  @Prop()
  insuranceType: string;

  @Prop()
  startDate: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'urgent'] })
  priority: string;

  @Prop()
  notes: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const IntakeRecordSchema = SchemaFactory.createForClass(IntakeRecord);
IntakeRecordSchema.index({ agencyId: 1, stage: 1 });
```

- [ ] **Step 2: Create DTOs**

`apps/backend/src/intake-records/dto/create-intake-record.dto.ts`:

```typescript
import { IsString, IsIn, IsOptional } from 'class-validator';

export class CreateIntakeRecordDto {
  @IsString()
  clientName: string;

  @IsString()
  agentName: string;

  @IsIn(['inquiry', 'assessment', 'authorization', 'onboarding', 'active'])
  stage: string;

  @IsString()
  referralSource: string;

  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority: string;

  @IsString()
  @IsOptional()
  primaryDiagnosis?: string;

  @IsString()
  @IsOptional()
  insuranceType?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

`apps/backend/src/intake-records/dto/update-intake-stage.dto.ts`:

```typescript
import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateIntakeStageDto {
  @IsIn(['inquiry', 'assessment', 'authorization', 'onboarding', 'active'])
  stage: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
```

- [ ] **Step 3: Create service**

`apps/backend/src/intake-records/intake-records.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IntakeRecord, IntakeRecordDocument } from './intake-record.schema';
import { CreateIntakeRecordDto } from './dto/create-intake-record.dto';
import { UpdateIntakeStageDto } from './dto/update-intake-stage.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class IntakeRecordsService {
  constructor(
    @InjectModel(IntakeRecord.name)
    private readonly model: Model<IntakeRecordDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'intake.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(actor: AuthUser, dto: CreateIntakeRecordDto) {
    requirePermission(actor.role, 'intake.write');
    const doc = await this.model.create({
      ...dto,
      agencyId: new Types.ObjectId(actor.agencyId),
    });
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: 'intake_record.created',
      resourceType: 'IntakeRecord',
      resourceId: doc._id.toString(),
    });
    return doc;
  }

  async updateStage(actor: AuthUser, id: string, dto: UpdateIntakeStageDto) {
    requirePermission(actor.role, 'intake.write');
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      { stage: dto.stage },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Intake record not found');
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: `intake_record.stage_${dto.stage}`,
      resourceType: 'IntakeRecord',
      resourceId: id,
    });
    return doc;
  }
}
```

- [ ] **Step 4: Create controller and module**

`apps/backend/src/intake-records/intake-records.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { IntakeRecordsService } from './intake-records.service';
import { CreateIntakeRecordDto } from './dto/create-intake-record.dto';
import { UpdateIntakeStageDto } from './dto/update-intake-stage.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intake-records')
export class IntakeRecordsController {
  constructor(private readonly service: IntakeRecordsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateIntakeRecordDto) {
    return this.service.create(actor, dto);
  }

  @Patch(':id/stage')
  updateStage(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateIntakeStageDto) {
    return this.service.updateStage(actor, id, dto);
  }
}
```

`apps/backend/src/intake-records/intake-records.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntakeRecord, IntakeRecordSchema } from './intake-record.schema';
import { IntakeRecordsService } from './intake-records.service';
import { IntakeRecordsController } from './intake-records.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: IntakeRecord.name, schema: IntakeRecordSchema }]),
    AuditModule,
  ],
  controllers: [IntakeRecordsController],
  providers: [IntakeRecordsService],
  exports: [IntakeRecordsService],
})
export class IntakeRecordsModule {}
```

- [ ] **Step 5: Typecheck and commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
git add apps/backend/src/intake-records/
git commit -m "feat: add IntakeRecords backend module"
```

---

### Task 6: Medical Availability — backend module

**Files:**
- Create: `apps/backend/src/medical-availability/medical-availability.schema.ts`
- Create: `apps/backend/src/medical-availability/dto/update-availability-status.dto.ts`
- Create: `apps/backend/src/medical-availability/medical-availability.service.ts`
- Create: `apps/backend/src/medical-availability/medical-availability.controller.ts`
- Create: `apps/backend/src/medical-availability/medical-availability.module.ts`

- [ ] **Step 1: Create schema**

`apps/backend/src/medical-availability/medical-availability.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MedicalAvailabilityDocument = MedicalAvailability & Document;

@Schema({ timestamps: true, collection: 'medicalAvailability' })
export class MedicalAvailability {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ required: true })
  clientName: string;

  @Prop({ type: Types.ObjectId })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  serviceType: string;

  @Prop({ required: true, enum: ['confirmed', 'pending', 'unavailable', 'on_hold'] })
  status: string;

  @Prop({ required: true })
  scheduledDate: string;

  @Prop()
  providerName: string;

  @Prop()
  notes: string;

  @Prop()
  confirmedAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const MedicalAvailabilitySchema = SchemaFactory.createForClass(MedicalAvailability);
MedicalAvailabilitySchema.index({ agencyId: 1, status: 1 });
```

- [ ] **Step 2: Create DTO, service, controller, module**

`apps/backend/src/medical-availability/dto/update-availability-status.dto.ts`:

```typescript
import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateAvailabilityStatusDto {
  @IsIn(['confirmed', 'pending', 'unavailable', 'on_hold'])
  status: 'confirmed' | 'pending' | 'unavailable' | 'on_hold';

  @IsString()
  @IsOptional()
  notes?: string;
}
```

`apps/backend/src/medical-availability/medical-availability.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicalAvailability, MedicalAvailabilityDocument } from './medical-availability.schema';
import { UpdateAvailabilityStatusDto } from './dto/update-availability-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class MedicalAvailabilityService {
  constructor(
    @InjectModel(MedicalAvailability.name)
    private readonly model: Model<MedicalAvailabilityDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'medical_availability.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ scheduledDate: 1 })
      .lean();
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateAvailabilityStatusDto) {
    requirePermission(actor.role, 'medical_availability.write');
    const update: Record<string, unknown> = { status: dto.status, notes: dto.notes };
    if (dto.status === 'confirmed') update.confirmedAt = new Date();
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Medical availability record not found');
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: `medical_availability.${dto.status}`,
      resourceType: 'MedicalAvailability',
      resourceId: id,
    });
    return doc;
  }
}
```

`apps/backend/src/medical-availability/medical-availability.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { MedicalAvailabilityService } from './medical-availability.service';
import { UpdateAvailabilityStatusDto } from './dto/update-availability-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-availability')
export class MedicalAvailabilityController {
  constructor(private readonly service: MedicalAvailabilityService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateAvailabilityStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }
}
```

`apps/backend/src/medical-availability/medical-availability.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedicalAvailability, MedicalAvailabilitySchema } from './medical-availability.schema';
import { MedicalAvailabilityService } from './medical-availability.service';
import { MedicalAvailabilityController } from './medical-availability.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MedicalAvailability.name, schema: MedicalAvailabilitySchema }]),
    AuditModule,
  ],
  controllers: [MedicalAvailabilityController],
  providers: [MedicalAvailabilityService],
  exports: [MedicalAvailabilityService],
})
export class MedicalAvailabilityModule {}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
git add apps/backend/src/medical-availability/
git commit -m "feat: add MedicalAvailability backend module"
```

---

### Task 7: Expiration Records — backend module

**Files:**
- Create: `apps/backend/src/expiration-records/expiration-record.schema.ts`
- Create: `apps/backend/src/expiration-records/dto/update-renewal-status.dto.ts`
- Create: `apps/backend/src/expiration-records/expiration-records.service.ts`
- Create: `apps/backend/src/expiration-records/expiration-records.controller.ts`
- Create: `apps/backend/src/expiration-records/expiration-records.module.ts`

- [ ] **Step 1: Create schema**

`apps/backend/src/expiration-records/expiration-record.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpirationRecordDocument = ExpirationRecord & Document;

@Schema({ timestamps: true, collection: 'expirationRecords' })
export class ExpirationRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId: Types.ObjectId;

  @Prop({ required: true })
  caregiverName: string;

  @Prop({ type: Types.ObjectId })
  caregiverId: Types.ObjectId;

  @Prop({ required: true })
  documentType: string;

  @Prop({ required: true })
  expiryDate: string;

  @Prop({ required: true, enum: ['current', 'expiring_soon', 'expired', 'renewed'] })
  status: string;

  @Prop()
  renewalSubmittedAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;
}

export const ExpirationRecordSchema = SchemaFactory.createForClass(ExpirationRecord);
ExpirationRecordSchema.index({ agencyId: 1, status: 1 });
ExpirationRecordSchema.index({ agencyId: 1, expiryDate: 1 });
```

- [ ] **Step 2: Create DTO, service, controller, module**

`apps/backend/src/expiration-records/dto/update-renewal-status.dto.ts`:

```typescript
import { IsIn } from 'class-validator';

export class UpdateRenewalStatusDto {
  @IsIn(['current', 'expiring_soon', 'expired', 'renewed'])
  status: 'current' | 'expiring_soon' | 'expired' | 'renewed';
}
```

`apps/backend/src/expiration-records/expiration-records.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpirationRecord, ExpirationRecordDocument } from './expiration-record.schema';
import { UpdateRenewalStatusDto } from './dto/update-renewal-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class ExpirationRecordsService {
  constructor(
    @InjectModel(ExpirationRecord.name)
    private readonly model: Model<ExpirationRecordDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'expiration.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ expiryDate: 1 })
      .lean();
  }

  async updateRenewalStatus(actor: AuthUser, id: string, dto: UpdateRenewalStatusDto) {
    requirePermission(actor.role, 'expiration.write');
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'renewed') update.renewalSubmittedAt = new Date();
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Expiration record not found');
    await this.auditService.log({
      agencyId: actor.agencyId,
      actorId: actor.sub,
      action: `expiration_record.${dto.status}`,
      resourceType: 'ExpirationRecord',
      resourceId: id,
    });
    return doc;
  }
}
```

`apps/backend/src/expiration-records/expiration-records.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { ExpirationRecordsService } from './expiration-records.service';
import { UpdateRenewalStatusDto } from './dto/update-renewal-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expiration-records')
export class ExpirationRecordsController {
  constructor(private readonly service: ExpirationRecordsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Patch(':id/renewal-status')
  updateRenewalStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateRenewalStatusDto) {
    return this.service.updateRenewalStatus(actor, id, dto);
  }
}
```

`apps/backend/src/expiration-records/expiration-records.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpirationRecord, ExpirationRecordSchema } from './expiration-record.schema';
import { ExpirationRecordsService } from './expiration-records.service';
import { ExpirationRecordsController } from './expiration-records.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExpirationRecord.name, schema: ExpirationRecordSchema }]),
    AuditModule,
  ],
  controllers: [ExpirationRecordsController],
  providers: [ExpirationRecordsService],
  exports: [ExpirationRecordsService],
})
export class ExpirationRecordsModule {}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
git add apps/backend/src/expiration-records/
git commit -m "feat: add ExpirationRecords backend module"
```

---

### Task 8: Register all 6 new modules in app.module.ts

**Files:**
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Add imports**

In `apps/backend/src/app.module.ts`, add these 6 import statements at the top (with existing imports):

```typescript
import { NurseApprovalsModule } from './nurse-approvals/nurse-approvals.module';
import { InspectionFindingsModule } from './inspection-findings/inspection-findings.module';
import { SocialWorkCasesModule } from './social-work-cases/social-work-cases.module';
import { IntakeRecordsModule } from './intake-records/intake-records.module';
import { MedicalAvailabilityModule } from './medical-availability/medical-availability.module';
import { ExpirationRecordsModule } from './expiration-records/expiration-records.module';
```

And add all 6 to the `imports: []` array in `@Module`:

```typescript
NurseApprovalsModule,
InspectionFindingsModule,
SocialWorkCasesModule,
IntakeRecordsModule,
MedicalAvailabilityModule,
ExpirationRecordsModule,
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/app.module.ts
git commit -m "feat: register 6 operational modules in AppModule"
```

---

### Task 9: Seed demo data for all 6 new collections

**Files:**
- Modify: `apps/backend/src/seed/demo-data.ts`

- [ ] **Step 1: Read the current seed file to find the seeding pattern and the agency/user IDs**

```bash
grep -n "agencyId\|agencyDoc\|nurseApproval\|await connection.collection" apps/backend/src/seed/demo-data.ts | head -40
```

- [ ] **Step 2: Add seed function for nurseApprovals collection**

After the existing seed blocks (before the return statement), add:

```typescript
// Nurse Approvals
await connection.collection('nurseApprovals').insertMany([
  {
    agencyId: agencyDoc._id,
    visitId: new Types.ObjectId(),
    clientName: 'Maria Johnson',
    caregiverName: 'Sandra Williams',
    visitDate: atTime(0, 9).toISOString().split('T')[0],
    visitType: 'Personal Care',
    status: 'pending_review',
    nurseNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    deletedAt: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    visitId: new Types.ObjectId(),
    clientName: 'Robert Chen',
    caregiverName: 'James Thompson',
    visitDate: daysAgo(2).toISOString().split('T')[0],
    visitType: 'Skilled Nursing',
    status: 'approved',
    nurseNotes: 'All vitals within normal range. Care plan followed.',
    reviewedBy: coordinatorDoc._id,
    reviewedAt: daysAgo(1),
    deletedAt: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    visitId: new Types.ObjectId(),
    clientName: 'Dorothy Williams',
    caregiverName: 'Maria Garcia',
    visitDate: daysAgo(3).toISOString().split('T')[0],
    visitType: 'Medication Management',
    status: 'needs_clarification',
    nurseNotes: 'Patient reported dizziness after medication. Follow-up required.',
    reviewedBy: coordinatorDoc._id,
    reviewedAt: daysAgo(2),
    deletedAt: null,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(2),
  },
]);
```

- [ ] **Step 3: Add seed for inspectionRules and inspectionFindings**

```typescript
// Inspection Rules
await connection.collection('inspectionRules').insertMany([
  { agencyId: agencyDoc._id, ruleCode: 'CARE-001', description: 'Care plan must be signed within 24 hours of visit', severity: 'critical', category: 'Documentation', active: true, deletedAt: null, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { agencyId: agencyDoc._id, ruleCode: 'CARE-002', description: 'Caregiver must complete required training annually', severity: 'high', category: 'Training', active: true, deletedAt: null, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { agencyId: agencyDoc._id, ruleCode: 'CARE-003', description: 'Incident reports must be filed within 2 hours', severity: 'critical', category: 'Reporting', active: true, deletedAt: null, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { agencyId: agencyDoc._id, ruleCode: 'CARE-004', description: 'Medication logs must be completed at each visit', severity: 'high', category: 'Medication', active: true, deletedAt: null, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { agencyId: agencyDoc._id, ruleCode: 'CARE-005', description: 'Client rights must be reviewed quarterly', severity: 'medium', category: 'Compliance', active: true, deletedAt: null, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { agencyId: agencyDoc._id, ruleCode: 'CARE-006', description: 'Emergency contact info must be current', severity: 'medium', category: 'Safety', active: true, deletedAt: null, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
]);

const ruleIds = await connection.collection('inspectionRules').find({ agencyId: agencyDoc._id }).toArray();

// Inspection Findings
await connection.collection('inspectionFindings').insertMany([
  {
    agencyId: agencyDoc._id,
    ruleId: ruleIds[0]._id,
    title: 'Care plan signature missing for 3 visits',
    severity: 'critical',
    status: 'open',
    description: 'Three visits in the past week have unsigned care plans.',
    assignedTo: 'Care Coordinator',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    resolvedAt: null,
    deletedAt: null,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    agencyId: agencyDoc._id,
    ruleId: ruleIds[1]._id,
    title: '2 caregivers with expired CPR certification',
    severity: 'high',
    status: 'in_progress',
    description: 'Sandra Williams and James Thompson CPR certs expired last month.',
    assignedTo: 'HR Manager',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    resolvedAt: null,
    deletedAt: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    ruleId: ruleIds[2]._id,
    title: 'Incident report filed 4 hours late',
    severity: 'critical',
    status: 'resolved',
    description: 'Report for incident on 05/18 was filed 4 hours past the 2-hour deadline.',
    assignedTo: 'Quality Assurance',
    dueDate: daysAgo(5).toISOString().split('T')[0],
    resolvedAt: daysAgo(3),
    deletedAt: null,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(3),
  },
]);
```

- [ ] **Step 4: Add seed for socialWorkCases**

```typescript
// Social Work Cases
await connection.collection('socialWorkCases').insertMany([
  {
    agencyId: agencyDoc._id,
    clientName: 'Eleanor Martinez',
    clientId: new Types.ObjectId(),
    assignedWorker: 'Social Worker A',
    category: 'housing',
    status: 'active',
    description: 'Client at risk of losing housing due to non-payment. Coordinating with housing authority.',
    nextFollowUp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'urgent',
    deletedAt: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    clientName: 'George Patterson',
    clientId: new Types.ObjectId(),
    assignedWorker: 'Social Worker B',
    category: 'benefits',
    status: 'pending_review',
    description: 'Medicaid renewal application submitted. Awaiting determination.',
    nextFollowUp: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'high',
    deletedAt: null,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
  },
  {
    agencyId: agencyDoc._id,
    clientName: 'Frances Cooper',
    clientId: new Types.ObjectId(),
    assignedWorker: 'Social Worker A',
    category: 'family',
    status: 'active',
    description: 'Family caregiver burnout. Coordinating respite care and support resources.',
    nextFollowUp: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'medium',
    deletedAt: null,
    createdAt: daysAgo(8),
    updatedAt: daysAgo(3),
  },
]);
```

- [ ] **Step 5: Add seed for intakeRecords**

```typescript
// Intake Records
await connection.collection('intakeRecords').insertMany([
  {
    agencyId: agencyDoc._id,
    clientName: 'Harold Jenkins',
    agentName: 'Intake Agent A',
    stage: 'assessment',
    referralSource: 'Hospital Discharge',
    primaryDiagnosis: 'Post-surgical recovery',
    insuranceType: 'Medicare',
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'high',
    notes: 'Patient discharged from St. Mary\'s. Needs 4 hrs/day personal care.',
    deletedAt: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    clientName: 'Sylvia Montgomery',
    agentName: 'Intake Agent B',
    stage: 'authorization',
    referralSource: 'Physician Referral',
    primaryDiagnosis: 'Alzheimer\'s Disease',
    insuranceType: 'Medicaid',
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    priority: 'medium',
    notes: 'Authorization submitted to Medicaid. Waiting approval.',
    deletedAt: null,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
  },
  {
    agencyId: agencyDoc._id,
    clientName: 'Walter Hughes',
    agentName: 'Intake Agent A',
    stage: 'inquiry',
    referralSource: 'Self-Referral',
    primaryDiagnosis: 'COPD',
    insuranceType: 'Private Pay',
    startDate: null,
    priority: 'low',
    notes: 'Initial inquiry call completed. Sending intake packet.',
    deletedAt: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
]);
```

- [ ] **Step 6: Add seed for medicalAvailability and expirationRecords**

```typescript
// Medical Availability
await connection.collection('medicalAvailability').insertMany([
  {
    agencyId: agencyDoc._id,
    clientName: 'Maria Johnson',
    clientId: new Types.ObjectId(),
    serviceType: 'Physical Therapy',
    status: 'confirmed',
    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    providerName: 'City Rehab Center',
    notes: 'Confirmed via phone. 3 sessions per week.',
    confirmedAt: daysAgo(1),
    deletedAt: null,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    clientName: 'Robert Chen',
    clientId: new Types.ObjectId(),
    serviceType: 'Wound Care',
    status: 'pending',
    scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    providerName: 'Home Health Plus',
    notes: 'Awaiting insurance pre-auth.',
    confirmedAt: null,
    deletedAt: null,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    agencyId: agencyDoc._id,
    clientName: 'Dorothy Williams',
    clientId: new Types.ObjectId(),
    serviceType: 'Lab Work',
    status: 'unavailable',
    scheduledDate: daysAgo(1).toISOString().split('T')[0],
    providerName: 'Quest Diagnostics',
    notes: 'Lab closed. Rescheduling required.',
    confirmedAt: null,
    deletedAt: null,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
  },
]);

// Expiration Records
const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const expired = daysAgo(5).toISOString().split('T')[0];
const current = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

await connection.collection('expirationRecords').insertMany([
  {
    agencyId: agencyDoc._id,
    caregiverName: 'Sandra Williams',
    caregiverId: new Types.ObjectId(),
    documentType: 'CPR Certification',
    expiryDate: sevenDays,
    status: 'expiring_soon',
    renewalSubmittedAt: null,
    deletedAt: null,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  },
  {
    agencyId: agencyDoc._id,
    caregiverName: 'James Thompson',
    caregiverId: new Types.ObjectId(),
    documentType: "Driver's License",
    expiryDate: expired,
    status: 'expired',
    renewalSubmittedAt: null,
    deletedAt: null,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(30),
  },
  {
    agencyId: agencyDoc._id,
    caregiverName: 'Maria Garcia',
    caregiverId: new Types.ObjectId(),
    documentType: 'First Aid Certification',
    expiryDate: thirtyDays,
    status: 'expiring_soon',
    renewalSubmittedAt: daysAgo(2),
    deletedAt: null,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(2),
  },
  {
    agencyId: agencyDoc._id,
    caregiverName: 'Robert Davis',
    caregiverId: new Types.ObjectId(),
    documentType: 'Background Check',
    expiryDate: current,
    status: 'current',
    renewalSubmittedAt: null,
    deletedAt: null,
    createdAt: daysAgo(365),
    updatedAt: daysAgo(365),
  },
]);
```

- [ ] **Step 7: Add return counts for the 6 new collections**

In the return object of `seedDemoData`, extend `counts` to include:
```typescript
nurseApprovals: 3,
inspectionRules: 6,
inspectionFindings: 3,
socialWorkCases: 3,
intakeRecords: 3,
medicalAvailability: 3,
expirationRecords: 4,
```

- [ ] **Step 8: Typecheck and commit**

```bash
cd apps/backend && npx tsc --noEmit 2>&1 | head -40
git add apps/backend/src/seed/demo-data.ts
git commit -m "feat: seed 6 new operational module collections"
```

---

### Task 10: Add API client functions — frontend

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`

- [ ] **Step 1: Add the 6 new API helper functions**

At the end of `apps/web/src/lib/api-client.ts` (before the last closing brace or export), add:

```typescript
export async function fetchNurseApprovals(role: DemoRole) {
  return callProtectedApi<NurseApproval[]>(role, '/nurse-approvals');
}

export async function decideNurseApproval(
  role: DemoRole,
  id: string,
  decision: 'approved' | 'rejected' | 'needs_clarification',
  nurseNotes?: string,
) {
  return callProtectedApi<NurseApproval>(role, `/nurse-approvals/${id}/decide`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, nurseNotes }),
  });
}

export async function fetchInspectionRules(role: DemoRole) {
  return callProtectedApi<InspectionRule[]>(role, '/inspection-findings/rules');
}

export async function fetchInspectionFindings(role: DemoRole) {
  return callProtectedApi<InspectionFinding[]>(role, '/inspection-findings');
}

export async function updateFindingStatus(
  role: DemoRole,
  id: string,
  status: 'open' | 'in_progress' | 'resolved' | 'waived',
) {
  return callProtectedApi<InspectionFinding>(role, `/inspection-findings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchSocialWorkCases(role: DemoRole) {
  return callProtectedApi<SocialWorkCase[]>(role, '/social-work-cases');
}

export async function updateSocialWorkCaseStatus(
  role: DemoRole,
  id: string,
  status: 'active' | 'pending_review' | 'closed' | 'escalated',
) {
  return callProtectedApi<SocialWorkCase>(role, `/social-work-cases/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchIntakeRecords(role: DemoRole) {
  return callProtectedApi<IntakeRecord[]>(role, '/intake-records');
}

export async function updateIntakeStage(role: DemoRole, id: string, stage: string) {
  return callProtectedApi<IntakeRecord>(role, `/intake-records/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });
}

export async function fetchMedicalAvailability(role: DemoRole) {
  return callProtectedApi<MedicalAvailabilityRecord[]>(role, '/medical-availability');
}

export async function updateMedicalAvailabilityStatus(
  role: DemoRole,
  id: string,
  status: 'confirmed' | 'pending' | 'unavailable' | 'on_hold',
) {
  return callProtectedApi<MedicalAvailabilityRecord>(role, `/medical-availability/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchExpirationRecords(role: DemoRole) {
  return callProtectedApi<ExpirationRecord[]>(role, '/expiration-records');
}

export async function updateRenewalStatus(
  role: DemoRole,
  id: string,
  status: 'current' | 'expiring_soon' | 'expired' | 'renewed',
) {
  return callProtectedApi<ExpirationRecord>(role, `/expiration-records/${id}/renewal-status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
```

Note: `NurseApproval`, `InspectionRule`, `InspectionFinding`, `SocialWorkCase`, `IntakeRecord`, `MedicalAvailabilityRecord`, `ExpirationRecord` must be imported from `'../types/careproof'`. Check what is already imported and add only what is missing.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api-client.ts
git commit -m "feat: add API client functions for 6 operational modules"
```

---

### Task 11: Update frontend screens with real API + loading/error/empty states

**Files:**
- Modify: `apps/web/src/components/careproof-ui.tsx` (lines 4827–5138)

This task updates all 7 new screens. The pattern for each is:
1. Replace the static `const items = demoArray` with `const [items, setItems] = useState(demoArray)`
2. Add `const [loading, setLoading] = useState(true)` and `const [error, setError] = useState<string | null>(null)`
3. Add a `useEffect` that calls the corresponding `api-client.ts` function, calls `setItems(data)` on success, calls `setError(e.message)` on failure, and calls `setLoading(false)` in finally
4. Add a loading skeleton before the return content: `if (loading) return <div className="p-6 animate-pulse">Loading...</div>`
5. Add an error banner below loading check: `{error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}`
6. On status-change actions, call the real API function then update local state only on success

**For NurseApprovalsScreen (line ~4827):**

Replace the screen's data setup with:
```typescript
const [approvals, setApprovals] = useState<NurseApproval[]>(nurseApprovals);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchNurseApprovals('admin')
    .then(setApprovals)
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

Replace the approve/reject handler to call the API:
```typescript
const handleDecision = async (id: string, decision: 'approved' | 'rejected' | 'needs_clarification') => {
  try {
    const updated = await decideNurseApproval('admin', id, decision);
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: updated.status } : a)));
    showToast(`Approval ${decision}`);
  } catch {
    showToast('Failed to update approval');
  }
};
```

Add at top of render:
```typescript
if (loading) return <div className="p-6 animate-pulse text-gray-400">Loading nurse approvals...</div>;
```

**For InspectionCenterScreen (line ~4896):**

```typescript
const [findings, setFindings] = useState<InspectionFinding[]>(inspectionFindings);
const [rules, setRules] = useState<InspectionRule[]>(inspectionRules);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  Promise.all([fetchInspectionFindings('admin'), fetchInspectionRules('admin')])
    .then(([f, r]) => { setFindings(f); setRules(r); })
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

Status change handler:
```typescript
const handleFindingStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved' | 'waived') => {
  try {
    await updateFindingStatus('admin', id, status);
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
  } catch {
    showToast('Failed to update finding');
  }
};
```

**For SocialWorkScreen (line ~4948):**

```typescript
const [cases, setCases] = useState<SocialWorkCase[]>(socialWorkCases);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchSocialWorkCases('admin')
    .then(setCases)
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

**For IntakeAgentsScreen (line ~4983):**

```typescript
const [records, setRecords] = useState<IntakeRecord[]>(intakeRecords);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchIntakeRecords('admin')
    .then(setRecords)
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

**For MedicalAvailabilityScreen (line ~5034):**

```typescript
const [records, setRecords] = useState<MedicalAvailabilityRecord[]>(medicalAvailabilityRecords);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchMedicalAvailability('admin')
    .then(setRecords)
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);
```

**For ExpirationCenterScreen (line ~5063):**

```typescript
const [records, setRecords] = useState<ExpirationRecord[]>(expirationRecords);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetchExpirationRecords('admin')
    .then(setRecords)
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, []);

const handleRenewal = async (id: string) => {
  try {
    await updateRenewalStatus('admin', id, 'renewed');
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'renewed' } : r)));
    showToast('Renewal submitted');
  } catch {
    showToast('Failed to submit renewal');
  }
};
```

**For SystemReadinessScreen (line ~5108):**

Replace the hardcoded static array with a `useEffect` that calls:
```typescript
const [checks, setChecks] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  callProtectedApi<SystemStatus>('admin', '/system/status')
    .then((data) => setChecks(data.checks ?? []))
    .catch(() => {})
    .finally(() => setLoading(false));
}, []);
```

- [ ] **Step 1: Read lines 4820–4840 to understand NurseApprovalsScreen structure**

```bash
sed -n '4820,4840p' apps/web/src/components/careproof-ui.tsx
```

- [ ] **Step 2: Apply all 7 screen updates as described above**

Edit `apps/web/src/components/careproof-ui.tsx` — update each screen one at a time.

- [ ] **Step 3: Verify imports at the top of careproof-ui.tsx include the new api-client functions**

Check that `fetchNurseApprovals`, `decideNurseApproval`, `fetchInspectionFindings`, `fetchInspectionRules`, `updateFindingStatus`, `fetchSocialWorkCases`, `updateSocialWorkCaseStatus`, `fetchIntakeRecords`, `updateIntakeStage`, `fetchMedicalAvailability`, `updateMedicalAvailabilityStatus`, `fetchExpirationRecords`, `updateRenewalStatus` are imported from `'../lib/api-client'`.

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/careproof-ui.tsx
git commit -m "feat: wire 7 frontend screens to real API with loading/error/empty states"
```

---

### Task 12: Write integration tests for operational modules

**Files:**
- Create: `apps/backend/test/operational-modules.spec.ts`

- [ ] **Step 1: Create the test file**

`apps/backend/test/operational-modules.spec.ts`:

```typescript
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/careproof_test_ops';
process.env.JWT_SECRET = 'test-secret';

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Connection, connect, Types } from 'mongoose';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { seedDemoData } from '../src/seed/demo-data';

let app: INestApplication;
let mongoConnection: Connection;
let adminToken: string;
let agencyId: string;
let nurseApprovalId: string;
let inspectionFindingId: string;
let socialWorkCaseId: string;
let intakeRecordId: string;
let medicalAvailabilityId: string;
let expirationRecordId: string;

beforeAll(async () => {
  const conn = await connect(process.env.MONGODB_URI!);
  mongoConnection = conn.connection;
  await mongoConnection.dropDatabase();
  const seed = await seedDemoData(mongoConnection);
  agencyId = seed.agencyId;

  const adminCredential = seed.credentials.find((c) => c.role === 'admin');
  await conn.disconnect();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: adminCredential!.email, password: adminCredential!.password });
  adminToken = loginRes.body.access_token;

  const conn2 = await connect(process.env.MONGODB_URI!);
  const mc = conn2.connection;
  const na = await mc.collection('nurseApprovals').findOne({ agencyId: new Types.ObjectId(agencyId) });
  nurseApprovalId = na!._id.toString();
  const inf = await mc.collection('inspectionFindings').findOne({ agencyId: new Types.ObjectId(agencyId) });
  inspectionFindingId = inf!._id.toString();
  const swc = await mc.collection('socialWorkCases').findOne({ agencyId: new Types.ObjectId(agencyId) });
  socialWorkCaseId = swc!._id.toString();
  const ir = await mc.collection('intakeRecords').findOne({ agencyId: new Types.ObjectId(agencyId) });
  intakeRecordId = ir!._id.toString();
  const ma = await mc.collection('medicalAvailability').findOne({ agencyId: new Types.ObjectId(agencyId) });
  medicalAvailabilityId = ma!._id.toString();
  const er = await mc.collection('expirationRecords').findOne({ agencyId: new Types.ObjectId(agencyId) });
  expirationRecordId = er!._id.toString();
  await conn2.disconnect();
});

afterAll(async () => {
  await app.close();
  const conn = await connect(process.env.MONGODB_URI!);
  await conn.connection.dropDatabase();
  await conn.disconnect();
});

describe('GET /nurse-approvals', () => {
  it('returns 200 with array', async () => {
    const res = await request(app.getHttpServer())
      .get('/nurse-approvals')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('clientName');
    expect(res.body[0]).toHaveProperty('status');
  });
});

describe('PATCH /nurse-approvals/:id/decide', () => {
  it('approves a nurse approval', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/nurse-approvals/${nurseApprovalId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved', nurseNotes: 'All good' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('rejects with invalid decision', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/nurse-approvals/${nurseApprovalId}/decide`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'invalid_decision' });
    expect(res.status).toBe(400);
  });
});

describe('GET /inspection-findings/rules', () => {
  it('returns inspection rules', async () => {
    const res = await request(app.getHttpServer())
      .get('/inspection-findings/rules')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('ruleCode');
  });
});

describe('GET /inspection-findings', () => {
  it('returns inspection findings', async () => {
    const res = await request(app.getHttpServer())
      .get('/inspection-findings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('PATCH /inspection-findings/:id/status', () => {
  it('updates finding status to in_progress', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/inspection-findings/${inspectionFindingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });
});

describe('GET /social-work-cases', () => {
  it('returns social work cases', async () => {
    const res = await request(app.getHttpServer())
      .get('/social-work-cases')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('clientName');
  });
});

describe('PATCH /social-work-cases/:id/status', () => {
  it('closes a social work case', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/social-work-cases/${socialWorkCaseId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
  });
});

describe('GET /intake-records', () => {
  it('returns intake records', async () => {
    const res = await request(app.getHttpServer())
      .get('/intake-records')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('PATCH /intake-records/:id/stage', () => {
  it('advances intake stage', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/intake-records/${intakeRecordId}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stage: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('active');
  });
});

describe('GET /medical-availability', () => {
  it('returns medical availability records', async () => {
    const res = await request(app.getHttpServer())
      .get('/medical-availability')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('PATCH /medical-availability/:id/status', () => {
  it('confirms medical availability', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/medical-availability/${medicalAvailabilityId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('confirmed');
  });
});

describe('GET /expiration-records', () => {
  it('returns expiration records', async () => {
    const res = await request(app.getHttpServer())
      .get('/expiration-records')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('documentType');
  });
});

describe('PATCH /expiration-records/:id/renewal-status', () => {
  it('marks record as renewed', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/expiration-records/${expirationRecordId}/renewal-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'renewed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('renewed');
  });

  it('rejects invalid renewal status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/expiration-records/${expirationRecordId}/renewal-status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'not_a_status' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd apps/backend && npx jest test/operational-modules.spec.ts --runInBand --testTimeout=60000 2>&1
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/backend/test/operational-modules.spec.ts
git commit -m "test: add integration tests for 6 operational modules"
```

---

### Task 13: Final verification — all checks pass

- [ ] **Step 1: Run backend lint**

```bash
cd apps/backend && pnpm lint 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 2: Run backend typecheck**

```bash
cd apps/backend && pnpm typecheck 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 3: Run all backend tests**

```bash
cd apps/backend && pnpm test 2>&1 | tail -30
```

Expected: all tests pass

- [ ] **Step 4: Run API tests**

```bash
API_BASE_URL=http://127.0.0.1:4000/api cd apps/backend && pnpm test:api 2>&1 | tail -30
```

- [ ] **Step 5: Run web typecheck**

```bash
cd apps/web && pnpm typecheck 2>&1 | tail -20
```

Expected: no errors

- [ ] **Step 6: Run web build**

```bash
cd apps/web && pnpm build 2>&1 | tail -20
```

Expected: build completes with no errors

- [ ] **Step 7: Final commit if anything was adjusted**

```bash
git add -p
git commit -m "fix: address lint/typecheck issues from final verification"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|-------------|-----------|
| Inspect existing backend structure | Done in pre-plan review |
| Follow existing backend patterns | Tasks 2–7 use exact incidents/ pattern |
| Add database models/schemas | Tasks 2–7, each with `@Schema`, soft delete, agencyId index |
| Add API routes/controllers/services | Tasks 2–7, each with GET list + PATCH status/decision |
| Add validation | All DTOs use class-validator decorators |
| Add seed data | Task 9 seeds all 6 collections |
| Connect frontend to real APIs | Tasks 10–11 |
| Preserve demo flow | `useState(demoArray)` as default, API updates state on success |
| Loading, error, empty states | Task 11 adds loading skeleton and error banner to each screen |
| Tests for API routes and core workflow | Task 12: 14 test cases covering all 6 modules |
| Do not break existing checks | Task 13 runs all checks |
| Notifications templates | Task 1 adds 5 new templates |
| Permissions for new modules | Task 1 adds 12 new actions |

**No placeholder scan:** All code blocks contain complete implementations. No "TBD" or "add error handling" stubs.

**Type consistency:** All service method signatures match controller call sites. DTO field names match schema `@Prop` names.
