import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

beforeEach(async () => {
  await resolveComponentResources(async (url: string) => {
    const cleanUrl = url.replace(/^\.\//, '');
    const candidatePaths = [
      resolve(process.cwd(), 'src/app', cleanUrl.replace(/\.(html|css)$/, ''), cleanUrl),
      resolve(process.cwd(), 'src/app/login', cleanUrl),
      resolve(process.cwd(), 'src/app/layout', cleanUrl),
      resolve(process.cwd(), 'src/app', cleanUrl),
      resolve(process.cwd(), 'src', cleanUrl),
    ];
    for (const filePath of candidatePaths) {
      try {
        return readFileSync(filePath, 'utf-8');
      } catch {
        // try next candidate
      }
    }
    return '';
  });
});
