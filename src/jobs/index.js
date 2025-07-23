/**
 * Job Runner
 * 
 * This is the main entry point for scheduled jobs on Render.
 * It determines which job to run based on environment variables or command line arguments.
 */
const { cleanupOldData } = require('./dataRetention');

// Get the job name from command line arguments or environment variables
const jobName = process.argv[2] || process.env.JOB_NAME || 'dataRetention';

async function runJob(name) {
  console.log(`Starting job: ${name} at ${new Date().toISOString()}`);
  
  try {
    switch (name) {
      case 'dataRetention':
        // Check if a custom retention period is specified in environment variables
        const retentionDays = process.env.RETENTION_DAYS ? parseInt(process.env.RETENTION_DAYS, 10) : 30;
        await cleanupOldData(retentionDays);
        break;
        
      // Add other jobs here as needed
      
      default:
        console.error(`Unknown job: ${name}`);
        process.exit(1);
    }
    
    console.log(`Job ${name} completed successfully at ${new Date().toISOString()}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error running job ${name}:`, error);
    process.exit(1);
  }
}

// Run the job
runJob(jobName);
