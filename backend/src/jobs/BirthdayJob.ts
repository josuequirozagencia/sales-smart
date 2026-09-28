import BirthdayService from "../services/BirthdayService/BirthdayService";
import { emitBirthdayEvents } from "../libs/socket"; // 🎂 NOVO IMPORT
import logger from "../utils/logger";
import Company from "../models/Company";
import BirthdaySettings from "../models/BirthdaySettings";
import moment, { Moment } from "moment-timezone";
import { businessTimezone } from "../helpers/RotationPolicy";
const CronJob = require("cron").CronJob;

/**
 * La hora de ahora en el huso del negocio, con los segundos a cero, tal y
 * como se guarda sendBirthdayTime.
 *
 * Antes esto se calculaba con new Date().getHours(), que da la hora del
 * contenedor. En Railway no hay TZ definida, asi que era UTC mientras el
 * cron declaraba Sao Paulo: un envio configurado a las 09:00 solo habria
 * coincidido cuando en Sao Paulo eran las 06:00. No se notaba porque la
 * consulta fallaba antes de llegar a comparar.
 *
 * El huso se pasa aparte para que los tests no dependan de como este
 * configurado el entorno donde corren.
 */
export const horaDeEnvioAhora = (
  ahora: Moment = moment(),
  huso: string = businessTimezone()
): string => ahora.clone().tz(huso).format("HH:mm:00");

/**
 * Job para processar aniversários diariamente
 * Executa todos os dias às 09:00
 */
export const startBirthdayJob = () => {
  const birthdayJob = new CronJob(
    "0 0 9 * * *", // Todos os dias às 09:00
    async () => {
      logger.info("🎂 Starting daily birthday processing job...");
      
      try {
        await BirthdayService.processTodayBirthdays();
        
        // 🎂 NOVO: Emitir eventos via socket para todas as empresas após processamento
        await emitBirthdayEventsToAllCompanies();
        
        logger.info("🎉 Daily birthday processing job completed successfully");
      } catch (error) {
        logger.error(`❌ Error in daily birthday processing job: ${(error as Error).message}`);
      }
    },
    null, // onComplete
    true, // start immediately
    businessTimezone() // timezone
  );

  logger.info("🎂 Birthday cron job initialized - will run daily at 09:00");
  
  return birthdayJob;
};

/**
 * 🎂 NOVO: Job para verificar e emitir eventos de aniversário periodicamente
 * Executa a cada 30 minutos durante o horário comercial para capturar novos logins
 */
export const startBirthdayNotificationJob = () => {
  const notificationJob = new CronJob(
    "0 */30 8-18 * * 1-5", // A cada 30 minutos, das 8h às 18h, segunda a sexta
    async () => {
      logger.info("🎂 Starting birthday notification check...");
      
      try {
        await emitBirthdayEventsToAllCompanies();
        logger.info("🎂 Birthday notification check completed");
      } catch (error) {
        logger.error(`❌ Error in birthday notification check: ${(error as Error).message}`);
      }
    },
    null, // onComplete
    true, // start immediately
    businessTimezone() // timezone
  );

  logger.info("🎂 Birthday notification job initialized - will run every 30 minutes during business hours");
  
  return notificationJob;
};

/**
 * 🎂 NOVA FUNÇÃO: Emitir eventos de aniversário para todas as empresas ativas
 */
const emitBirthdayEventsToAllCompanies = async () => {
  try {
    const activeCompanies = await Company.findAll({
      where: { status: true },
      attributes: ['id']
    });

    logger.info(`🎂 Emitting birthday events for ${activeCompanies.length} active companies`);

    for (const company of activeCompanies) {
      try {
        const birthdayData = await BirthdayService.getTodayBirthdaysForCompany(company.id);
        
        // Só emitir se houver aniversariantes
        if (birthdayData.users.length > 0 || birthdayData.contacts.length > 0) {
          await emitBirthdayEvents(company.id);
          logger.info(`🎂 Events emitted for company ${company.id}: ${birthdayData.users.length} users, ${birthdayData.contacts.length} contacts`);
        }
      } catch (error) {
        logger.error(`🎂 Error emitting events for company ${company.id}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    logger.error(`🎂 Error in emitBirthdayEventsToAllCompanies: ${(error as Error).message}`);
  }
};

/**
 * Job para limpar informativos expirados
 * Executa todo dia à meia-noite
 */
export const startCleanupJob = () => {
  const cleanupJob = new CronJob(
    "0 0 0 * * *", // Todo dia à meia-noite
    async () => {
      logger.info("🧹 Starting expired announcements cleanup job...");
      
      try {
        const { default: Announcement } = await import("../models/Announcement");
        const cleanedCount = await Announcement.cleanExpiredAnnouncements();
        
        if (cleanedCount > 0) {
          logger.info(`🗑️ Cleaned ${cleanedCount} expired announcements`);
        } else {
          logger.info("✨ No expired announcements to clean");
        }
      } catch (error) {
        logger.error(`❌ Error in cleanup job: ${(error as Error).message}`);
      }
    },
    null, // onComplete
    true, // start immediately
    businessTimezone() // timezone
  );

  logger.info("🧹 Cleanup cron job initialized - will run daily at midnight");
  
  return cleanupJob;
};

/**
 * 🎂 NOVA FUNÇÃO: Job para processar aniversários no horário configurado
 * Executa no horário definido nas configurações de cada empresa
 */
export const startDynamicBirthdayJob = () => {
  const dynamicJob = new CronJob(
    "0 */15 * * * *", // A cada 15 minutos - verifica se é hora de enviar mensagens
    async () => {
      try {
        const currentTime = horaDeEnvioAhora();

        // Buscar empresas que têm horário de envio configurado para agora
        const companies = await Company.findAll({
          where: { status: true },
          include: [{
            model: BirthdaySettings,
            where: {
              sendBirthdayTime: currentTime,
              contactBirthdayEnabled: true
            },
            required: true
          }]
        });

        if (companies.length > 0) {
          logger.info(`🎂 Processing birthday messages for ${companies.length} companies at ${currentTime}`);
          
          for (const company of companies) {
            try {
              const birthdayData = await BirthdayService.getTodayBirthdaysForCompany(company.id);
              
              // Enviar mensagens para contatos aniversariantes
              for (const contact of birthdayData.contacts) {
                await BirthdayService.sendBirthdayMessageToContact(contact.id, company.id);
              }
              
              // Emitir eventos via socket
              if (birthdayData.users.length > 0 || birthdayData.contacts.length > 0) {
                await emitBirthdayEvents(company.id);
              }
            } catch (error) {
              logger.error(`🎂 Error processing birthday for company ${company.id}: ${(error as Error).message}`);
            }
          }
        }
      } catch (error) {
        logger.error(`🎂 Error in dynamic birthday job: ${(error as Error).message}`);
      }
    },
    null, // onComplete
    true, // start immediately
    businessTimezone() // timezone
  );

  logger.info("🎂 Dynamic birthday job initialized - will check every 15 minutes for scheduled sends");
  
  return dynamicJob;
};

/**
 * Inicializa todos os jobs relacionados a aniversários
 */
export const initializeBirthdayJobs = () => {
  const birthdayJob = startBirthdayJob();
  const notificationJob = startBirthdayNotificationJob(); // 🎂 NOVO
  const dynamicJob = startDynamicBirthdayJob(); // 🎂 NOVO
  const cleanupJob = startCleanupJob();
  
  // Graceful shutdown
  const shutdown = () => {
    logger.info('🛑 Stopping birthday jobs...');
    birthdayJob.stop();
    notificationJob.stop(); // 🎂 NOVO
    dynamicJob.stop(); // 🎂 NOVO
    cleanupJob.stop();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { 
    birthdayJob, 
    notificationJob, // 🎂 NOVO
    dynamicJob, // 🎂 NOVO
    cleanupJob 
  };
};

/**
 * 🎂 NOVA FUNÇÃO EXPORTADA: Para executar verificação manual via API
 */
export const triggerBirthdayCheck = async (companyId?: number) => {
  try {
    if (companyId) {
      // Verificar uma empresa específica
      await emitBirthdayEvents(companyId);
      logger.info(`🎂 Manual birthday check triggered for company ${companyId}`);
    } else {
      // Verificar todas as empresas
      await emitBirthdayEventsToAllCompanies();
      logger.info("🎂 Manual birthday check triggered for all companies");
    }
  } catch (error) {
    logger.error(`🎂 Error in manual birthday check: ${(error as Error).message}`);
    throw error;
  }
};