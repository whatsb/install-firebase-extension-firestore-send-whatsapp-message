#!/usr/bin/env node

import { execa } from 'execa'; // Note: Execa uses ES Modules (import/export)
import fs from 'fs';
import path from 'path';
import degit from 'degit';

const ZIP_DIR = "firestore-send-whatsapp-message";
const workDir = process.cwd();

/**
 * Runs a command where the USER types their own inputs live.
 */
async function runManualCommand(command, args) {
    // Setting stdin to 'inherit' connects the user's live keyboard directly to the command
    const child = execa(command, args, {
        cwd: workDir,
        stdin: 'inherit',  // <--- Crucial line for manual input
        stdout: 'inherit', // Standard piping so they see what's happening
        stderr: 'inherit'
    });

    await child;
}

async function runAutomatedCommand(command, args, interactionMap = {}) {
    // Spawns the command cross-platform safely
    const child = execa(command, args, {
        cwd: workDir,
        all: true, // Merges stdout and stderr into a single readable stream
    });

    // 1. Immediately print the CLI's native output to the screen to maintain live logs
    let sessionBuffer = ''; // Buffer to accumulate output for prompt detection

    // Monitor the internal "all" stream to hunt for interactive prompts
    child.all.on('data', (data) => {
        const chunk = data.toString().toLowerCase();

        const cleanChunk = chunk
            .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
            .toLowerCase();

        sessionBuffer += cleanChunk;
        process.stdout.write(chunk);

        for (const [triggerText, responseKey] of Object.entries(interactionMap)) {
            if (sessionBuffer.includes(triggerText.toLowerCase())) {
                try {
                    // 2. This log will now appear exactly where the trigger text was detected
                    child.stdout.write(`\n[Automated Response] Detected prompt: "${triggerText}". Responding with: "${responseKey.trim()}"\n`);
                    // Send the keystroke to the process
                    child.stdin.write(responseKey);

                    sessionBuffer = ''; // Clear buffer after responding to avoid multiple triggers
                } catch (err) {
                    // Fail silently if the stream closed early
                }
                break;
            }
        }
    });

    // Wait for completion gracefully
    await child;
}

function parseArgs() {
    const args = process.argv.slice(2);
    const projectIdFlagIndex = args.findIndex(arg => arg === '--project-id' || arg === '-p');

    if (projectIdFlagIndex === -1 || projectIdFlagIndex === args.length - 1) {
        console.error('Error: --project-id is required.');
        console.error('Usage: cli.js --project-id <PROJECT_ID>');
        process.exit(1);
    }

    return args[projectIdFlagIndex + 1];
}

async function main() {
    const projectId = parseArgs();

    // delete existing repo directory, eZIP_DIRs dir if it exists to ensure a clean slate
    const repoPath = path.join(workDir, ZIP_DIR);
    if (fs.existsSync(repoPath)) {
        console.log(`\nCleaning up existing directory: ${ZIP_DIR}`);
        fs.rmSync(repoPath, { recursive: true, force: true });
    }
    const extensionsPath = path.join(workDir, 'extensions');
    if (fs.existsSync(extensionsPath)) {
        console.log(`\nCleaning up existing directory: extensions`);
        fs.rmSync(extensionsPath, { recursive: true, force: true });
    }
    // clean firebase.json file and remove .firebaserc file if they exist to prevent any conflicts
    const firebaseJsonPath = path.join(workDir, 'firebase.json');
    if (fs.existsSync(firebaseJsonPath)) {
        console.log(`\nCleaning up existing file: firebase.json`);
        fs.rmSync(firebaseJsonPath, { force: true });
    }
    const firebasercPath = path.join(workDir, '.firebaserc');
    if (fs.existsSync(firebasercPath)) {
        console.log(`\nCleaning up existing file: .firebaserc`);
        fs.rmSync(firebasercPath, { force: true });
    }

    // create firebase.json file with empty object "{}"
    fs.writeFileSync(firebaseJsonPath, '{}', 'utf-8');

    console.log("\nStep 1: Fetching repository head with degit (branch: main)...");
    const emitter = degit('whatsb/firebase-extension-firestore-send-whatsapp-message#main', { cache: false, force: true, verbose: false });
    const targetPath = path.join(workDir, ZIP_DIR);
    if (fs.existsSync(targetPath)) {
        console.log(`\nCleaning up existing directory: ${ZIP_DIR}`);
        fs.rmSync(targetPath, { recursive: true, force: true });
    }
    await emitter.clone(targetPath);

    console.log("\nStep 2: Installing local Extension...");ZIP_DIR
    await runManualCommand('npx', ['firebase-tools', 'ext:install', `./${ZIP_DIR}`, '--project', projectId]);

    console.log("\nStep 3: Deploying Extension securely...");
    await runAutomatedCommand('npx', ['firebase-tools', 'deploy', '--only', 'extensions', '--project', projectId], {
        "delete": "N\n",
        "changes will be overwritten": "Y\n",
        "proceed with this deployment": "Y\n"
    });

    // post installation cleanup - remove the cloned repo and extensions directory to leave a clean slate
    if (fs.existsSync(repoPath)) {ZIP_DIR
        console.log(`\nCleaning up directory: ${ZIP_DIR}`);
        fs.rmSync(repoPath, { recursive: true, force: true });
    }
    if (fs.existsSync(extensionsPath)) {
        console.log(`\nCleaning up directory: extensions`);
        fs.rmSync(extensionsPath, { recursive: true, force: true });
    }
    // remove firebase.json file and .firebaserc file to prevent any conflicts for future runs
    if (fs.existsSync(firebaseJsonPath)) {
        console.log(`\nCleaning up file: firebase.json`);
        fs.rmSync(firebaseJsonPath, { force: true });
    }
    if (fs.existsSync(firebasercPath)) {
        console.log(`\nCleaning up file: .firebaserc`);
        fs.rmSync(firebasercPath, { force: true });
    }

    console.log("\nDeployment completed!");
}

main().catch(err => {
    console.error("\nExecution failed:", err.message);
    process.exit(1);
});