import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hospitals, prices, analytics, jobs } from "../schema";

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DATABASE_USERNAME || "postgres"}:${process.env.DATABASE_PASSWORD || "postgres"}@${process.env.DATABASE_HOST || "localhost"}:${process.env.DATABASE_PORT || 5432}/${process.env.DATABASE_NAME || "glimmr"}`;

const client = postgres(connectionString);
const db = drizzle(client);

export async function seedInitialData() {
  console.log("🌱 Starting database seeding...");

  try {
    // Seed hospitals
    console.log("📊 Seeding hospitals...");
    const hospitalData = await db
      .insert(hospitals)
      .values([
        {
          name: "Mayo Clinic",
          state: "MN",
          city: "Rochester",
          address: "200 First St SW",
          zipCode: "55905",
          phone: "(507) 284-2511",
          website: "https://www.mayoclinic.org",
          bedCount: 1265,
          ownership: "non-profit",
          hospitalType: "general",
          teachingStatus: true,
          npiNumber: "1234567890",
          cmsProviderNumber: "240001",
          dataSource: "manual",
        },
        {
          name: "Cleveland Clinic",
          state: "OH",
          city: "Cleveland",
          address: "9500 Euclid Ave",
          zipCode: "44195",
          phone: "(216) 444-2200",
          website: "https://my.clevelandclinic.org",
          bedCount: 1285,
          ownership: "non-profit",
          hospitalType: "general",
          teachingStatus: true,
          npiNumber: "1234567891",
          cmsProviderNumber: "360001",
          dataSource: "manual",
        },
        {
          name: "Johns Hopkins Hospital",
          state: "MD",
          city: "Baltimore",
          address: "1800 Orleans St",
          zipCode: "21287",
          phone: "(410) 955-5000",
          website: "https://www.hopkinsmedicine.org",
          bedCount: 1154,
          ownership: "non-profit",
          hospitalType: "general",
          teachingStatus: true,
          traumaLevel: "I",
          npiNumber: "1234567892",
          cmsProviderNumber: "210001",
          dataSource: "manual",
        },
      ])
      .returning();

    console.log(`✅ Seeded ${hospitalData.length} hospitals`);

    // Seed prices for each hospital
    console.log("💰 Seeding prices...");
    const priceData = [];

    for (const hospital of hospitalData) {
      priceData.push(
        {
          hospitalId: hospital.id,
          serviceName: "Emergency Room Visit - Level 4",
          serviceCode: "99284",
          codeType: "CPT",
          description:
            "Emergency department visit for evaluation and management of a patient",
          category: "emergency",
          grossCharge: "2500.00",
          discountedCashPrice: "1800.00",
          minimumNegotiatedRate: "1200.00",
          maximumNegotiatedRate: "2200.00",
          dataSource: "cms",
          reportingPeriod: "2024-Q1",
          hasNegotiatedRates: true,
          dataQuality: "high",
        },
        {
          hospitalId: hospital.id,
          serviceName: "MRI Brain without Contrast",
          serviceCode: "70551",
          codeType: "CPT",
          description: "Magnetic resonance imaging of brain without contrast",
          category: "imaging",
          grossCharge: "3200.00",
          discountedCashPrice: "2400.00",
          minimumNegotiatedRate: "1800.00",
          maximumNegotiatedRate: "2800.00",
          dataSource: "cms",
          reportingPeriod: "2024-Q1",
          hasNegotiatedRates: true,
          dataQuality: "high",
        },
        {
          hospitalId: hospital.id,
          serviceName: "Appendectomy - Laparoscopic",
          serviceCode: "44970",
          codeType: "CPT",
          description: "Laparoscopic appendectomy",
          category: "surgery",
          grossCharge: "15000.00",
          discountedCashPrice: "12000.00",
          minimumNegotiatedRate: "8000.00",
          maximumNegotiatedRate: "13000.00",
          dataSource: "cms",
          reportingPeriod: "2024-Q1",
          hasNegotiatedRates: true,
          dataQuality: "high",
        },
      );
    }

    const insertedPrices = await db
      .insert(prices)
      .values(priceData)
      .returning();
    console.log(`✅ Seeded ${insertedPrices.length} price records`);

    // Seed analytics
    console.log("📈 Seeding analytics...");
    const analyticsData = await db
      .insert(analytics)
      .values([
        {
          metricName: "average_er_visit_cost",
          metricType: "average",
          value: "2166.67",
          serviceCategory: "emergency",
          serviceName: "Emergency Room Visit - Level 4",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 3,
          confidence: "0.95",
        },
        {
          metricName: "average_mri_cost",
          metricType: "average",
          value: "2866.67",
          serviceCategory: "imaging",
          serviceName: "MRI Brain without Contrast",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 3,
          confidence: "0.95",
        },
        {
          metricName: "hospital_count_by_state",
          metricType: "count",
          value: "1",
          state: "MN",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 1,
        },
        {
          metricName: "hospital_count_by_state",
          metricType: "count",
          value: "1",
          state: "OH",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 1,
        },
        {
          metricName: "hospital_count_by_state",
          metricType: "count",
          value: "1",
          state: "MD",
          period: "2024-Q1",
          periodType: "quarter",
          sampleSize: 1,
        },
      ])
      .returning();

    console.log(`✅ Seeded ${analyticsData.length} analytics records`);

    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedInitialData().catch(console.error);
}
