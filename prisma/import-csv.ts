import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import csv from 'csv-parser';

const prisma = new PrismaClient();

async function importRooms() {
  const file = path.resolve(__dirname, '../data/rooms.csv');
  if (!fs.existsSync(file)) {
    console.warn('rooms.csv not found, skipping rooms import');
    return;
  }

  const rows: Array<Record<string, string>> = [];
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', async () => {
        for (const r of rows) {
          // convert some values
          const price = parseFloat(r.hourly_rate) || 0;
          const minCharge = parseInt(r.minimum_charge, 10) || 0;
          const isActive = String(r.is_active).toLowerCase() === 'true';

          await prisma.room.upsert({
            where: { id: r.id },
            update: {},
            create: {
              id: r.id,
              name: r.name,
              category: r.activity_type || 'UNKNOWN',
              pricePerHour: price,
              minMinutes: minCharge,
              status: isActive ? 'available' : 'maintenance',
            },
          });
        }
        console.log(`imported ${rows.length} rooms`);
        resolve();
      })
      .on('error', reject);
  });
}

async function importProducts() {
  const file = path.resolve(__dirname, '../data/products.csv');
  if (!fs.existsSync(file)) {
    console.warn('products.csv not found, skipping products import');
    return;
  }

  const rows: Array<Record<string, string>> = [];
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(file, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', async () => {
        const seenCategories = new Set<string>();
        let inserted = 0;
        let skipped = 0;

        for (const r of rows) {
          try {
            // ensure category exists
            const categoryId = r.category_id;
            if (categoryId && !seenCategories.has(categoryId)) {
              await prisma.category.upsert({
                where: { id: categoryId },
                update: {},
                create: {
                  id: categoryId,
                  name: r.type || 'Imported category',
                },
              });
              seenCategories.add(categoryId);
            }

            // check if product already exists
            const existing = await prisma.product.findUnique({
              where: { id: r.id },
            });

            if (existing) {
              skipped++;
              continue;
            }

            await prisma.product.create({
              data: {
                id: r.id,
                name: r.name,
                categoryId: categoryId || '',
                price: parseFloat(r.price) || 0,
                cost: 0,
                stockQty: parseInt(r.stock, 10) || 0,
                imageUrl: r.image_url || undefined,
              },
            });
            inserted++;
          } catch (err) {
            console.error(`Error importing product ${r.id} (${r.name}):`, err);
          }
        }
        console.log(`products: ${inserted} inserted, ${skipped} skipped (total ${rows.length})`);
        resolve();
      })
      .on('error', reject);
  });
}

async function main() {
  try {
    await importRooms();
    await importProducts();
  } catch (err) {
    console.error('error importing csv', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
