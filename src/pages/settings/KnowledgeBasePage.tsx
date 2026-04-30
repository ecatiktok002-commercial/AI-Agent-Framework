import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search,
  Edit2,
  Trash2,
  Save,
  X as XIcon,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileText,
  UploadCloud,
  Image as ImageIcon,
  Box,
  FolderOpen,
  Database
} from 'lucide-react';
import { supabase } from '../../supabase';
import { KnowledgeFact } from '../../types';
import { cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function KnowledgeBasePage() {
  const [facts, setFacts] = useState<KnowledgeFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<KnowledgeFact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pyramid state
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteProductConfirmName, setDeleteProductConfirmName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  
  // PDF Extraction States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingPDF, setIsExtractingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    product_name: '',
    category: '',
    topic: '',
    fact: '',
    image_url: '',
    is_active: true
  });

  const [pdfDocuments, setPdfDocuments] = useState<any[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(true);
  const [exportingDocId, setExportingDocId] = useState<string | null>(null);

  useEffect(() => {
    fetchFacts();
    fetchPdfDocuments();
  }, []);

  const fetchPdfDocuments = async () => {
    setLoadingPdfs(true);
    let query = supabase.from('pdf_documents').select('*').order('created_at', { ascending: false });
    const { data } = await query;
    setPdfDocuments(data || []);
    setLoadingPdfs(false);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFacts = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    let query = supabase.from('company_knowledge').select('*').order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching facts:', error);
      showToast('Failed to load knowledge base', 'error');
    } else {
      setFacts(data || []);
      // Reset selections if products/categories changed
      if (data && data.length > 0 && showLoading) {
        // Initial setup
      }
    }
    if (showLoading) setLoading(false);
  };

  const handleOpenModal = (fact?: KnowledgeFact) => {
    if (fact) {
      setEditingFact(fact);
      setFormData({
        product_name: fact.product_name || '',
        category: fact.category,
        topic: fact.topic,
        fact: fact.fact,
        image_url: fact.image_url || '',
        is_active: fact.is_active
      });
    } else {
      setEditingFact(null);
      setFormData({
        product_name: selectedProduct || '',
        category: selectedCategory || '',
        topic: '',
        fact: '',
        image_url: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.product_name || !formData.category || !formData.topic || !formData.fact) {
      showToast('Please fill in all required fields (Product, Category, Topic, Fact)', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        product_name: formData.product_name,
        category: formData.category,
        topic: formData.topic,
        fact: formData.fact,
        is_active: formData.is_active
      };
      
      if (formData.image_url) {
        payload.image_url = formData.image_url;
      }

      if (editingFact) {
        const { error } = await supabase
          .from('company_knowledge')
          .update(payload)
          .eq('id', editingFact.id);

        if (error) throw error;
        showToast('Fact updated successfully');
      } else {
        const { error } = await supabase
          .from('company_knowledge')
          .insert([payload]);

        if (error) throw error;
        showToast('New fact added successfully');
      }
      setIsModalOpen(false);
      fetchFacts(false);
    } catch (error: any) {
      console.error('Error saving fact:', error);
      if (error?.code === 'PGRST204' || error?.message?.includes('schema cache')) {
        showToast('Database Error: Please ensure "product_name" column exists in the "company_knowledge" table on Supabase, or reload your schema cache via the Supabase dashboard.', 'error');
      } else {
        showToast('Failed to save fact. Make sure the database schema is updated.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPdf = async (documentId: string) => {
    setExportingDocId(documentId);
    showToast('Exporting to Knowledge Base...', 'success');
    try {
      const response = await fetch('/api/functions/export-pdf-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId })
      });
      const res = await response.json();
      if (!response.ok || res.error) throw new Error(res.error || "Failed to export");
      showToast(`Exported ${res.data?.count || 0} facts successfully!`, 'success');
      fetchPdfDocuments();
      fetchFacts();
    } catch (e: any) {
      console.error(e);
      showToast('Export failed: ' + e.message, 'error');
    } finally {
      setExportingDocId(null);
    }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingPDF(true);
    setPdfProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let pdfText = '';
      const imageUrls: string[] = [];

      const numPages = pdf.numPages;
      for (let i = 1; i <= numPages; i++) {
          setPdfProgress(Math.round(((i-1) / numPages) * 50)); 
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          pdfText += `\n--- Page ${i} ---\n${pageText}`;

          const viewport = page.getViewport({ scale: 2.0 }); 
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext('2d');
          if (context) {
              await page.render({ canvasContext: context, viewport } as any).promise;
              const blob: Blob = await new Promise(resolve => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.8));
              
              const fileName = `global/pdf_${Date.now()}_page_${i}.jpg`;
              const { error } = await supabase.storage.from('knowledge_media').upload(fileName, blob, { contentType: 'image/jpeg' });
              if (error) {
                console.error("Upload error page", i, error);
              } else {
                const { data: publicUrlData } = supabase.storage.from('knowledge_media').getPublicUrl(fileName);
                imageUrls.push(publicUrlData.publicUrl);
              }
          }
      }

      setPdfProgress(75); 

      const response = await fetch('/api/functions/extract-pdf-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfText, imageUrls, fileName: file.name })
      });
      const res = await response.json();

      if (!response.ok || res.error) throw new Error(res.error || "Failed to extract");

      setPdfProgress(100);
      showToast('PDF extracted successfully to Markdown!', 'success');
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPdfDocuments();
    } catch (error: any) {
      console.error("PDF Extract error", error);
      showToast('Error parsing PDF: ' + error.message, 'error');
    } finally {
      setIsExtractingPDF(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileName = `global/fact_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('knowledge_media').upload(fileName, file);
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('knowledge_media').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, image_url: publicUrlData.publicUrl }));
      showToast('Image uploaded successfully', 'success');
    } catch (error: any) {
      console.error("Image Upload error", error);
      showToast('Error uploading image: ' + error.message, 'error');
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('company_knowledge')
        .delete()
        .eq('id', deleteConfirmId);

      if (error) throw error;
      showToast('Fact deleted successfully');
      fetchFacts(false);
    } catch (error: any) {
      console.error('Error deleting fact:', error);
      showToast('Failed to delete fact', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteProduct = (productName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteProductConfirmName(productName);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductConfirmName) return;
    
    setIsDeleting(true);
    try {
      // product_name is a field in the knowledge facts, we want to delete ALL facts matching it
      const { error } = await supabase
        .from('company_knowledge')
        .delete()
        .eq('product_name', deleteProductConfirmName);

      if (error) throw error;
      showToast(`Product "${deleteProductConfirmName}" and its facts deleted successfully`);
      if (selectedProduct === deleteProductConfirmName) {
        setSelectedProduct(null);
        setSelectedCategory(null);
      }
      fetchFacts(false);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      showToast('Failed to delete product', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteProductConfirmName(null);
    }
  };

  const defaultCategories = [
    'Device Specifications & Parts',
    'Therapy Benefits & Usage Limits',
    'Safety & Contraindications',
    'Pricing & Demo Booking'
  ];

  // Pyramid Logic Processing
  const filteredFacts = useMemo(() => {
    if (!searchQuery) return facts;
    return facts.filter(f => 
      (f.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.topic || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.fact || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [facts, searchQuery]);

  const tree = useMemo(() => {
    const structure: Record<string, Record<string, KnowledgeFact[]>> = {};
    for (const f of filteredFacts) {
      const prod = f.product_name || 'General';
      const cat = f.category || 'Uncategorized';
      if (!structure[prod]) structure[prod] = {};
      if (!structure[prod][cat]) structure[prod][cat] = [];
      structure[prod][cat].push(f);
    }
    return structure;
  }, [filteredFacts]);

  // Derived arrays for UI
  const products = Object.keys(tree).sort();
  
  // Auto-select first product if none selected or if selected vanishes
  useEffect(() => {
    if (products.length > 0 && (!selectedProduct || !products.includes(selectedProduct))) {
      setSelectedProduct(products[0]);
    } else if (products.length === 0) {
      setSelectedProduct(null);
    }
  }, [products, selectedProduct]);

  const currentCategories = selectedProduct && tree[selectedProduct] ? Object.keys(tree[selectedProduct] || {}).sort() : [];

  useEffect(() => {
    if (currentCategories.length > 0 && (!selectedCategory || !currentCategories.includes(selectedCategory))) {
      setSelectedCategory(currentCategories[0]);
    } else if (currentCategories.length === 0) {
      setSelectedCategory(null);
    }
  }, [currentCategories, selectedCategory]);

  const activeFacts = selectedProduct && selectedCategory && tree[selectedProduct] ? (tree[selectedProduct][selectedCategory] || []) : [];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto pb-32">
      {/* Header section... untouched logic, just styling */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Knowledge Base
            <BookOpen className="w-6 h-6 text-slate-400" />
          </h1>
          <p className="text-slate-500 max-w-2xl text-sm">
            Hierarchy-driven facts repository. Products ➝ Categories ➝ Topics.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handlePDFUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtractingPDF}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
          >
            {isExtractingPDF ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {isExtractingPDF ? `Extracting (${pdfProgress}%)...` : 'Upload PDF'}
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add Knowledge Entry
          </button>
        </div>
      </div>

      {loadingPdfs ? null : pdfDocuments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Processing Pipeline
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pdfDocuments.map(doc => (
              <div key={doc.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{doc.file_name}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      doc.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      doc.status === 'exported' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {doc.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 max-w-lg font-mono">
                    {doc.content_markdown.substring(0, 80)}...
                  </p>
                </div>
                {doc.status === 'pending' && (
                  <button
                    onClick={() => handleExportPdf(doc.id)}
                    disabled={exportingDocId === doc.id}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm active:translate-y-0.5 disabled:opacity-50 whitespace-nowrap"
                  >
                    {exportingDocId === doc.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    Deploy to AI Memory
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pyramid UI */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text"
          placeholder="Search across all products, categories, topics, and facts..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[700px]">
        
        {/* Column 1: Products */}
        <div className="w-full lg:w-64 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[10px] font-bold text-slate-500 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
               <Box className="w-4 h-4 text-violet-500" />
               Products
            </div>
            <button 
              onClick={() => handleOpenModal()} 
              className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-black transition-colors"
              title="Add New Product"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
            {products.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">No products found</div>
            ) : (
              products.map(prod => (
                <button
                  key={prod}
                  onClick={() => { setSelectedProduct(prod); setSelectedCategory(null); }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all text-left group",
                    selectedProduct === prod 
                      ? "bg-violet-50 text-violet-700 font-bold border border-violet-100" 
                      : "text-slate-600 hover:bg-slate-50 font-medium border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                      <span className="truncate">{prod}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div 
                      onClick={(e) => handleDeleteProduct(prod, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 md:hover:bg-red-100 md:hover:text-red-600 text-slate-400 transition-all shrink-0 cursor-pointer"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 shrink-0 transition-transform", 
                      selectedProduct === prod ? "text-violet-500 translate-x-1" : "text-slate-300 opacity-0 group-hover:opacity-100"
                    )} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Categories */}
        <div className="w-full lg:w-64 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden shrink-0">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 uppercase tracking-widest text-[10px] font-bold text-slate-500 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2">
               <FolderOpen className="w-4 h-4 text-blue-500" />
               Categories
             </div>
             {selectedProduct && <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-[9px]">{currentCategories.length}</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
            {!selectedProduct ? (
              <div className="p-8 text-center flex flex-col items-center gap-2 text-slate-400">
                <Box className="w-8 h-8 text-slate-200" />
                <p className="text-xs">Select a product first</p>
              </div>
            ) : currentCategories.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">No categories inside {selectedProduct}</div>
            ) : (
              currentCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm transition-all text-left",
                    selectedCategory === cat 
                      ? "bg-white shadow-sm border border-slate-200 text-slate-900 font-bold" 
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent font-medium"
                  )}
                >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="truncate">{cat}</span>
                  </div>
                  {selectedCategory === cat && <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Facts Details */}
        <div className="flex-1 flex flex-col bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-2xl shadow-sm overflow-hidden min-w-0">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                {selectedCategory ? `Facts in '${selectedCategory}'` : 'Facts Viewer'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {selectedProduct && selectedCategory ? (
                  <span className="flex items-center gap-1.5">
                    <span className="bg-violet-100 text-violet-700 px-1.5 rounded text-[10px] uppercase font-bold">{selectedProduct}</span>
                    <span>→ {activeFacts.length} {activeFacts.length === 1 ? 'entry' : 'entries'}</span>
                  </span>
                ) : (
                  "Select a product and category to view facts"
                )}
              </p>
            </div>
            {selectedProduct && selectedCategory && activeFacts.length > 0 && (
              <button 
                onClick={() => handleOpenModal()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                title="Add a fact directly to this category"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Fact Here
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/30">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <p className="text-sm">Loading facts...</p>
              </div>
            ) : !selectedProduct || !selectedCategory ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
                  <Database className="w-8 h-8 text-slate-300" />
                </div>
                <div className="text-center max-w-sm">
                   <p className="text-sm font-medium text-slate-600">No category selected</p>
                   <p className="text-xs mt-1 leading-relaxed">Select a product from the left, then choose a category to view the associated factual knowledge.</p>
                </div>
              </div>
            ) : activeFacts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                <div className="p-4 bg-slate-100 rounded-full">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                </div>
                <div className="text-center">
                   <p className="text-sm font-medium text-slate-600">No facts recorded here</p>
                   <p className="text-xs mt-1 mb-4">Add a new fact to populate this category.</p>
                   <button 
                      onClick={() => handleOpenModal()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Fact
                    </button>
                </div>
              </div>
            ) : (
              activeFacts.map((fact) => (
                <div key={fact.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="text-sm font-bold text-slate-900">{fact.topic}</h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          fact.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {fact.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                       <button 
                        onClick={() => handleOpenModal(fact)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(fact.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl font-mono whitespace-pre-wrap border border-slate-100">
                    {fact.fact}
                  </div>

                  {fact.image_url && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                       <div className="flex items-center gap-2 mb-2">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visual Reference</span>
                       </div>
                       <a href={fact.image_url} target="_blank" rel="noreferrer" className="block w-full max-w-sm rounded-xl overflow-hidden border border-slate-200 hover:border-violet-400 transition-colors">
                         <img src={fact.image_url} alt="Fact visually" className="w-full h-auto object-cover max-h-48" />
                       </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-5 h-5 text-violet-600" />
                  {editingFact ? 'Edit Knowledge Fact' : 'New Knowledge Fact'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200 bg-slate-100 rounded-full transition-colors"
                >
                  <XIcon className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Field */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Product Name</label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="e.g. Myvi Extractor V2"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm pr-10"
                        value={formData.product_name}
                        onChange={(e) => {
                          setFormData({ ...formData, product_name: e.target.value });
                          setIsProductDropdownOpen(true);
                        }}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsProductDropdownOpen(false), 200)}
                      />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    
                    {isProductDropdownOpen && products.length > 0 && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {products.map(prod => (
                            <button
                              key={prod}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-black transition-colors border-b last:border-0 border-slate-50"
                              onClick={() => {
                                setFormData({ ...formData, product_name: prod });
                                setIsProductDropdownOpen(false);
                              }}
                            >
                              {prod}
                            </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Field */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="e.g. Warranty"
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm pr-10"
                        value={formData.category}
                        onChange={(e) => {
                          setFormData({ ...formData, category: e.target.value });
                          setIsCategoryDropdownOpen(true);
                        }}
                        onFocus={() => setIsCategoryDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setIsCategoryDropdownOpen(false), 200)}
                      />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    
                    {isCategoryDropdownOpen && (
                      <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {(Array.from(new Set([...defaultCategories, ...(formData.product_name ? facts.filter(f => f.product_name === formData.product_name).map(f => f.category) : facts.map(f => f.category))])) as string[])
                          .filter(Boolean)
                          .map(cat => (
                            <button
                              key={cat}
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-black transition-colors border-b last:border-0 border-slate-50"
                              onClick={() => {
                                setFormData({ ...formData, category: cat });
                                setIsCategoryDropdownOpen(false);
                              }}
                            >
                              {cat}
                            </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Topic</label>
                  <input 
                    type="text"
                    placeholder="e.g. Rate for standard repairs"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Factual Content</label>
                  <textarea 
                    placeholder="Enter the factual details that the AI should know..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-inner min-h-[160px] resize-none transition-all font-mono"
                    value={formData.fact}
                    onChange={(e) => setFormData({ ...formData, fact: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Visual Attachment (Optional)</label>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {formData.image_url ? (
                      <div className="relative w-20 h-20 rounded-xl border border-slate-200 overflow-hidden shadow-sm group">
                        <img src={formData.image_url} alt="Attachment" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                          className="absolute inset-0 bg-red-500/80 hidden group-hover:flex items-center justify-center transition-all"
                        >
                          <XIcon className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 bg-white shadow-sm">
                        <ImageIcon className="w-5 h-5 mb-1 opacity-60" />
                      </div>
                    )}
                    <div className="flex-1">
                       <input 
                         type="file"
                         accept="image/*"
                         className="hidden"
                         ref={imageInputRef}
                         onChange={handleImageUpload}
                       />
                       <button
                         type="button"
                         onClick={() => imageInputRef.current?.click()}
                         className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 mb-2"
                       >
                         <UploadCloud className="w-4 h-4" />
                         Upload Reference
                       </button>
                       <p className="text-[10px] text-slate-500 font-medium">JPEG, PNG. Provided to users when appropriate.</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100 text-emerald-600"
                    )}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Active State</p>
                      <p className="text-[11px] text-emerald-700">Currently in use by AI system</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none shadow-inner",
                      formData.is_active ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-all shadow-sm",
                      formData.is_active ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingFact ? 'Update Fact' : 'Publish Fact'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Product Confirmation Modal */}
      <AnimatePresence>
        {deleteProductConfirmName && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteProductConfirmName(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-100">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Delete Product?</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Are you sure you want to delete <strong>{deleteProductConfirmName}</strong>? All categories and facts inside this product will be permanently deleted.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setDeleteProductConfirmName(null)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDeleteProduct}
                  disabled={isDeleting}
                  className={cn(
                    "flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md",
                    isDeleting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Product
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-100">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Delete Knowledge?</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  The AI will no longer know about this fact. This action is permanent.
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className={cn(
                    "flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md",
                    isDeleting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-[100]"
          >
            <div className={cn(
              "px-6 py-4 rounded-2xl shadow-xl border flex items-center gap-3 max-w-sm",
              toast.type === 'success' 
                ? "bg-slate-900 border-slate-800 text-white" 
                : "bg-red-600 border-red-500 text-white"
            )}>
              {toast.type === 'success' ? (
                 <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                 <AlertCircle className="w-5 h-5 text-white shrink-0" />
              )}
              <span className="text-sm font-medium leading-snug">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
