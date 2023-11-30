import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv'
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

dotenv.config()

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(process.env.SERVER_NAME)
  //Swagger
  const config = new DocumentBuilder()
    .setTitle('CONSULTATION')
    .setDescription('Microservice dùng để quản lí cuộc hẹn')
    .setVersion('1.0')
    .setContact('White Hat', '', 'truonggolang@gmail.com')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup(process.env.SERVER_NAME, app, document, {
    customfavIcon: 'https://cdn.icon-icons.com/icons2/2107/PNG/512/file_type_swagger_icon_130134.png',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
    ],
  })
  //endSwagger

  app.useGlobalPipes(new ValidationPipe())

  app.enableCors({
    // origin: 'https://healthline.vn',
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true
  })
  await app.listen(3006);
}
bootstrap();
