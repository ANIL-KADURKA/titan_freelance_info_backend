import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AwsDocumentUploadService } from './aws-document-upload.service.js';
import { DocumentValidationService } from './document-validation.service.js';

@Module({
  imports: [PrismaModule],
  providers: [DocumentValidationService, AwsDocumentUploadService],
  exports: [DocumentValidationService, AwsDocumentUploadService],
})
export class CommonModule {}
