<script setup lang="ts">
import { ref, watch } from 'vue';
import { Download, FileJson, Trash2 } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import ImageDropZone from './ImageDropZone.vue';
import ImagePreview from './ImagePreview.vue';
import ExifDataTable from './ExifDataTable.vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  parseExifData,
  exportExifAsJson,
  stripExifData,
  MAX_FILE_SIZE,
  type ParsedExifData,
} from '../../../shared/utilities/exif-reader';

const selectedFile = ref<File | null>(null);
const exifData = ref<ParsedExifData | null>(null);
const isLoading = ref(false);
const activeTab = ref('view');

const handleFileSelected = async (file: File) => {
  // Validate file size before processing
  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
    toast.error(`File too large: ${fileSizeMB}MB (max ${maxSizeMB}MB)`);
    return;
  }

  selectedFile.value = file;
  isLoading.value = true;
  exifData.value = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    exifData.value = parseExifData(arrayBuffer);
    toast.success('EXIF data loaded successfully');
  } catch (error) {
    console.error('Error parsing EXIF data:', error);
    toast.error('Failed to parse EXIF data from image');
  } finally {
    isLoading.value = false;
  }
};

const clearImage = () => {
  selectedFile.value = null;
  exifData.value = null;
  activeTab.value = 'view';
};

const exportAsJson = () => {
  if (!exifData.value) return;

  try {
    const jsonString = exportExifAsJson(exifData.value);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedFile.value?.name.replace(/\.[^/.]+$/, '')}_exif.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('EXIF data exported as JSON');
  } catch (error) {
    console.error('Error exporting EXIF data:', error);
    toast.error('Failed to export EXIF data');
  }
};

const handleStripExif = async () => {
  if (!selectedFile.value) return;

  // Validate file size before processing
  if (selectedFile.value.size > MAX_FILE_SIZE) {
    const maxSizeMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
    const fileSizeMB = (selectedFile.value.size / 1024 / 1024).toFixed(1);
    toast.error(`File too large: ${fileSizeMB}MB (max ${maxSizeMB}MB)`);
    return;
  }

  try {
    const arrayBuffer = await selectedFile.value.arrayBuffer();
    const result = await stripExifData(arrayBuffer, selectedFile.value.type);

    if (!result.success) {
      toast.error(result.error || 'Failed to strip EXIF data');
      return;
    }

    // Create a blob from the stripped buffer
    const blob = new Blob([result.buffer], { type: selectedFile.value.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const originalName = selectedFile.value.name.replace(/\.[^/.]+$/, '');
    const extension = selectedFile.value.name.split('.').pop();
    a.download = `${originalName}_no_exif.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('EXIF data stripped and image downloaded');
  } catch (error) {
    console.error('Error stripping EXIF data:', error);
    toast.error('Failed to strip EXIF data');
  }
};

watch(selectedFile, newFile => {
  if (!newFile) {
    exifData.value = null;
  }
});
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">EXIF Viewer</h2>
        <p class="text-muted-foreground mt-1">
          View, export, and remove EXIF metadata from your images
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Left Column: Image Upload & Preview -->
        <div class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Image Upload</CardTitle>
              <CardDescription> Select an image to view its EXIF metadata </CardDescription>
            </CardHeader>
            <CardContent>
              <ImageDropZone v-if="!selectedFile" @file-selected="handleFileSelected" />
              <ImagePreview v-else :file="selectedFile" @clear="clearImage" />
            </CardContent>
          </Card>
        </div>

        <!-- Right Column: EXIF Data -->
        <div>
          <Card>
            <CardHeader>
              <div class="flex items-start justify-between">
                <div>
                  <CardTitle>EXIF Metadata</CardTitle>
                  <CardDescription> View and manage image metadata </CardDescription>
                </div>
                <div v-if="exifData" class="flex gap-2">
                  <Button @click="exportAsJson" variant="outline" size="sm">
                    <FileJson class="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs v-model="activeTab" class="w-full">
                <TabsList class="grid w-full grid-cols-2">
                  <TabsTrigger value="view">View Data</TabsTrigger>
                  <TabsTrigger value="edit" :disabled="!exifData">Edit</TabsTrigger>
                </TabsList>

                <TabsContent value="view" class="mt-4">
                  <div v-if="isLoading" class="bg-muted/50 rounded-lg border p-12 text-center">
                    <p class="text-muted-foreground">Loading EXIF data...</p>
                  </div>
                  <ExifDataTable v-else :exif-data="exifData" />
                </TabsContent>

                <TabsContent value="edit" class="mt-4">
                  <div v-if="exifData" class="space-y-4">
                    <div class="bg-muted/50 rounded-lg border p-4">
                      <p class="text-muted-foreground mb-4 text-sm">
                        Remove EXIF metadata from your image to protect privacy and reduce file
                        size.
                      </p>
                      <Button @click="handleStripExif" variant="destructive" class="w-full">
                        <Trash2 class="mr-2 h-4 w-4" />
                        Strip All EXIF Data
                      </Button>
                    </div>

                    <div class="bg-card rounded-lg border p-4">
                      <h4 class="mb-2 text-sm font-semibold">Privacy Note</h4>
                      <p class="text-muted-foreground text-xs">
                        EXIF data can contain sensitive information including GPS location, camera
                        details, and timestamps. Always review before sharing images.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  </div>
</template>
