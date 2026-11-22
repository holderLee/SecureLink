<template>
  <div :class="{ hidden: hidden }" class="pagination">
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :background="background"
      :layout="layout"
      :page-sizes="pageSizes"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup lang="ts">
import { PropType } from "vue";
import { scrollTo } from "@/utils/scroll-to";
import { useVModel } from "@vueuse/core";

const props = defineProps({
  /** 总条数 */
  total: {
    required: true,
    type: Number as PropType<number>,
    default: 0,
  },
  /** 页码 */
  page: {
    type: Number,
    default: 1,
  },
  /** 每页显示条数 */
  limit: {
    type: Number,
    default: 20,
  },
  /** 可选的页码大小 */
  pageSizes: {
    type: Array as PropType<number[]>,
    default() {
      return [10, 20, 30, 50];
    },
  },
  /** 布局 */
  layout: {
    type: String,
    default: "total, sizes, prev, pager, next, jumper",
  },
  /** 背景色 */
  background: {
    type: Boolean,
    default: true,
  },
  /** 自动滚动 */
  autoScroll: {
    type: Boolean,
    default: true,
  },
  /** 隐藏 */
  hidden: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits(["pagination", "update:page", "update:limit"]);
const currentPage = useVModel(props, "page", emit);
const pageSize = useVModel(props, "limit", emit);

const handleSizeChange = (val: number) => {
  emit("pagination", { page: currentPage, limit: val });
  if (props.autoScroll) {
    scrollTo(0, 800);
  }
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  emit("pagination", { page: val, limit: props.limit });
  if (props.autoScroll) {
    scrollTo(0, 800);
  }
};
</script>

<style lang="scss" scoped>
.pagination {
  padding: 12px;

  &.hidden {
    display: none;
  }
}
</style>
