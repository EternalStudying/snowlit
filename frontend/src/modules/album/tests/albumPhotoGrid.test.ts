import { mount } from '@vue/test-utils';
import { expect, it, vi } from 'vitest';
import Sortable from 'sortablejs';
import AlbumPhotoGrid from '../components/AlbumPhotoGrid.vue';

it('moves the selected cover to the front and destroys Sortable when the dialog grid unmounts', async () => {
  const destroy = vi.spyOn(Sortable.prototype, 'destroy');
  const wrapper = mount(AlbumPhotoGrid, {props:{disabled:false,items:[{key:'one',src:'/one.jpg',status:'success',message:'已上传'},{key:'two',src:'/two.jpg',status:'success',message:'已上传'}]}});
  expect(wrapper.findAll('.album-photo-grid__cover')).toHaveLength(1);
  await wrapper.findAll('button').find(button => button.text()==='设为封面')!.trigger('click');
  expect(wrapper.emitted('reorder')).toEqual([[1,0]]);
  wrapper.unmount(); expect(destroy).toHaveBeenCalledOnce(); destroy.mockRestore();
});
