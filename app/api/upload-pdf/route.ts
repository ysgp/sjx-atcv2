import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;
    
    // Rating form data (optional)
    const ratingData = formData.get('ratingData') as string | null;

    if (!file || !filename) {
      return NextResponse.json(
        { error: 'Missing file or filename' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const BUCKET_NAME = 'rating-forms';

    // Check if bucket exists, create if not
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
    
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
      if (createError && !createError.message.includes('already exists')) {
        console.error('Bucket creation error:', createError);
        return NextResponse.json(
          { error: 'Failed to create storage bucket: ' + createError.message },
          { status: 500 }
        );
      }
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { error: 'Upload failed: ' + error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    // Save rating result to database if ratingData is provided
    let resultId = null;
    if (ratingData) {
      try {
        const rating = JSON.parse(ratingData);
        const { data: insertData, error: insertError } = await supabase
          .from('sjx_results')
          .insert([{
            callsign: rating.callsign,
            exam_type: rating.exam_type, // 'rating_atc', 'rating_a350', 'rating_a321a339'
            score: rating.score,
            passed: rating.passed,
            detailed_answers: {
              ...rating.details,
              pdf_url: urlData.publicUrl,
              examiner: rating.examiner,
              pilot_name: rating.pilot_name,
              date: rating.date,
            },
          }])
          .select('id')
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
        } else {
          resultId = insertData?.id;
        }
      } catch (parseError) {
        console.error('Rating data parse error:', parseError);
      }
    }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      resultId,
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
