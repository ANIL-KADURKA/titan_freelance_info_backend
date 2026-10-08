import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AwsDocumentUploadService } from './aws-document-upload.service.js';
import { CloudinaryService } from './cloudinary.service.js';
import { DocumentValidationService } from './document-validation.service.js';
import { FirebaseAuthService } from './firebase-auth.service.js';
import { MailService } from './mail.service.js';
import { S3StorageService } from './s3-storage.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    DocumentValidationService,
    AwsDocumentUploadService,
    S3StorageService,
    MailService,
    FirebaseAuthService,
    CloudinaryService,
  ],
  exports: [
    DocumentValidationService,
    AwsDocumentUploadService,
    S3StorageService,
    MailService,
    FirebaseAuthService,
    CloudinaryService,
  ],
})
export class CommonModule {}
