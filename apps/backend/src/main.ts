import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Eterloop Backend API')
    .setDescription('Dokumentasi API untuk orkestrasi bot trading Eterloop')
    .setVersion('1.0.0')
    .addTag('Candles', 'Endpoint sinkronisasi dan data pasar')
    .addTag('ML', 'Endpoint prediksi Machine Learning')
    .build()

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
